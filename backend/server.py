from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict, BeforeValidator
from typing import List, Optional, Annotated, Any
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo
from bson import ObjectId
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)

# DEMO mode: if DEMO=true, use isolated 'demodb' with sample data
IS_DEMO = os.environ.get("DEMO", "false").strip().lower() == "true"
_db_name = "demodb" if IS_DEMO else os.environ['DB_NAME']
db = client[_db_name]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI(title="Jivdani Vegetable Suppliers")
api_router = APIRouter(prefix="/api")

# ---- Rate Limiting ----
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------------------------- Helpers -----------------------------
PyObjectId = Annotated[str, BeforeValidator(str)]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_str() -> str:
    return now_utc().date().isoformat()


def tomorrow_str() -> str:
    return (now_utc().date() + timedelta(days=1)).isoformat()


DEFAULT_TZ = "Asia/Kolkata"


async def get_settings_doc() -> dict:
    doc = await db.settings.find_one({"_id": "global"})
    if not doc:
        doc = {"_id": "global", "cutoff_enabled": False, "cutoff_time": "20:00", "timezone": DEFAULT_TZ}
        await db.settings.insert_one(doc)
    # Internal helper: settings uses string _id ("global"), safe to return.
    return dict(doc)


def compute_lock(doc: dict):
    tz = ZoneInfo(doc.get("timezone") or DEFAULT_TZ)
    now_local = datetime.now(tz)
    locked = False
    if doc.get("cutoff_enabled"):
        try:
            hh, mm = (int(x) for x in str(doc.get("cutoff_time", "20:00")).split(":"))
            cutoff_dt = now_local.replace(hour=hh, minute=mm, second=0, microsecond=0)
            locked = now_local >= cutoff_dt
        except Exception:
            locked = False
    return locked, now_local


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now_utc() + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_doc = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        # Internal helper: returns raw doc (with ObjectId) for role checks; API routes serialize() before returning.
        return dict(user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_active_restaurant(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant access required")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Account pending admin approval")
    return user


# ----------------------------- Models -----------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = ""
    address: Optional[str] = ""


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class RestaurantCreateInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = ""
    address: Optional[str] = ""


class RestaurantUpdateInput(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None


class VegetableInput(BaseModel):
    name: str
    unit: str = "kg"
    category: Optional[str] = "General"
    rate: float = 0.0
    active: bool = True
    image: Optional[str] = ""


class VegetableUpdateInput(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    rate: Optional[float] = None
    active: Optional[bool] = None
    image: Optional[str] = None


class RateUpdateItem(BaseModel):
    vegetable_id: str
    rate: float


class RateBulkUpdate(BaseModel):
    rates: List[RateUpdateItem]


class OrderItemInput(BaseModel):
    vegetable_id: str
    qty: float


class OrderCreateInput(BaseModel):
    items: List[OrderItemInput]
    notes: Optional[str] = ""
    delivery_date: Optional[str] = None


class OrderConfirmItem(BaseModel):
    vegetable_id: str
    name: str
    unit: str
    qty: float
    rate: float


class OrderConfirmInput(BaseModel):
    items: List[OrderConfirmItem]
    status: Optional[str] = "confirmed"
    notes: Optional[str] = None


class PaymentInput(BaseModel):
    restaurant_id: str
    amount: float
    note: Optional[str] = ""


class SettingsUpdate(BaseModel):
    cutoff_enabled: Optional[bool] = None
    cutoff_time: Optional[str] = None


class ProfileUpdateInput(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class PasswordChangeInput(BaseModel):
    current_password: str
    new_password: str


# ----------------------------- Supplier / Purchase Models -----------------------------
class SupplierInput(BaseModel):
    name: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""


class SupplierUpdateInput(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class PurchaseBillItem(BaseModel):
    name: str
    qty: float
    unit: str = "kg"
    rate: float


class PurchaseBillInput(BaseModel):
    supplier_id: str
    bill_no: Optional[str] = ""
    bill_date: str
    items: List[PurchaseBillItem]
    notes: Optional[str] = ""


class PurchaseBillUpdateInput(BaseModel):
    supplier_id: Optional[str] = None
    bill_no: Optional[str] = None
    bill_date: Optional[str] = None
    items: Optional[List[PurchaseBillItem]] = None
    notes: Optional[str] = None
    paid: Optional[bool] = None


class SupplierPaymentInput(BaseModel):
    supplier_id: str
    bill_id: Optional[str] = ""
    amount: float
    note: Optional[str] = ""
    payment_date: Optional[str] = None


# ----------------------------- Expense Models -----------------------------
class ExpenseInput(BaseModel):
    category: str
    amount: float
    expense_date: str
    bill_ref: Optional[str] = ""
    notes: Optional[str] = ""


class ExpenseUpdateInput(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    expense_date: Optional[str] = None
    bill_ref: Optional[str] = None
    notes: Optional[str] = None


# ----------------------------- Config Route -----------------------------
@api_router.get("/config")
async def get_config():
    """Returns public app configuration (demo mode flag)."""
    return {"demo": IS_DEMO}


# ----------------------------- Auth Routes -----------------------------
@api_router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, data: RegisterInput):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "name": data.name,
        "email": email,
        "password_hash": hash_password(data.password),
        "phone": data.phone or "",
        "address": data.address or "",
        "role": "restaurant",
        "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {
        "message": "Registration successful. Your account is awaiting admin approval.",
        "user": serialize(doc),
    }


@api_router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, data: LoginInput):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), user["role"])
    return {"token": token, "user": serialize(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize(user)


@api_router.put("/auth/me")
async def update_me(data: ProfileUpdateInput, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    refreshed = await db.users.find_one({"_id": user["_id"]})
    return serialize(refreshed)


@api_router.post("/auth/change-password")
@limiter.limit("10/minute")
async def change_password(request: Request, data: PasswordChangeInput, user: dict = Depends(get_current_user)):
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(data.new_password)}},
    )
    return {"message": "Password updated successfully"}


# ----------------------------- Vegetable Routes -----------------------------
@api_router.get("/vegetables")
async def list_vegetables(user: dict = Depends(get_current_user)):
    query = {} if user.get("role") == "admin" else {"active": True}
    vegs = await db.vegetables.find(query).sort("name", 1).to_list(1000)
    return [serialize(v) for v in vegs]


@api_router.post("/vegetables")
async def create_vegetable(data: VegetableInput, user: dict = Depends(require_admin)):
    doc = data.model_dump()
    doc["created_at"] = now_utc().isoformat()
    res = await db.vegetables.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@api_router.put("/vegetables/{veg_id}")
async def update_vegetable(veg_id: str, data: VegetableUpdateInput, user: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.vegetables.update_one({"_id": ObjectId(veg_id)}, {"$set": update})
    doc = await db.vegetables.find_one({"_id": ObjectId(veg_id)})
    return serialize(doc)


@api_router.delete("/vegetables/{veg_id}")
async def delete_vegetable(veg_id: str, user: dict = Depends(require_admin)):
    await db.vegetables.delete_one({"_id": ObjectId(veg_id)})
    return {"message": "Deleted"}


@api_router.post("/vegetables/rates/bulk")
async def bulk_update_rates(data: RateBulkUpdate, user: dict = Depends(require_admin)):
    for item in data.rates:
        await db.vegetables.update_one(
            {"_id": ObjectId(item.vegetable_id)},
            {"$set": {"rate": item.rate, "rate_updated_at": now_utc().isoformat()}},
        )
    # snapshot daily rates
    await db.daily_rates.update_one(
        {"date": today_str()},
        {"$set": {
            "date": today_str(),
            "rates": [{"vegetable_id": i.vegetable_id, "rate": i.rate} for i in data.rates],
            "updated_at": now_utc().isoformat(),
        }},
        upsert=True,
    )
    return {"message": "Rates updated", "count": len(data.rates)}


# ----------------------------- Order Routes -----------------------------
async def _build_order_items(items: List[OrderItemInput]):
    built = []
    total = 0.0
    for it in items:
        if it.qty <= 0:
            continue
        veg = await db.vegetables.find_one({"_id": ObjectId(it.vegetable_id)})
        if not veg:
            continue
        rate = float(veg.get("rate", 0))
        amount = round(rate * it.qty, 2)
        total += amount
        built.append({
            "vegetable_id": str(veg["_id"]),
            "name": veg["name"],
            "unit": veg.get("unit", "kg"),
            "qty": it.qty,
            "rate": rate,
            "amount": amount,
        })
    return built, round(total, 2)


@api_router.post("/orders")
@limiter.limit("30/minute")
async def create_order(request: Request, data: OrderCreateInput, user: dict = Depends(require_active_restaurant)):
    settings = await get_settings_doc()
    locked, _ = compute_lock(settings)
    if locked:
        raise HTTPException(
            status_code=403,
            detail=f"Ordering is closed for today (cut-off {settings.get('cutoff_time')} IST). Please order before the cut-off for next-morning delivery.",
        )
    items, total = await _build_order_items(data.items)
    if not items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")
    doc = {
        "restaurant_id": str(user["_id"]),
        "restaurant_name": user["name"],
        "items": items,
        "total": total,
        "estimated_total": total,
        "status": "pending",
        "notes": data.notes or "",
        "order_date": today_str(),
        "delivery_date": data.delivery_date or tomorrow_str(),
        "created_at": now_utc().isoformat(),
    }
    res = await db.orders.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@api_router.get("/orders")
async def list_orders(
    status: Optional[str] = None,
    restaurant_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {}
    if user.get("role") == "restaurant":
        query["restaurant_id"] = str(user["_id"])
    elif restaurant_id:
        query["restaurant_id"] = restaurant_id
    if status:
        query["status"] = status
    orders = await db.orders.find(query).sort("created_at", -1).to_list(2000)
    return [serialize(o) for o in orders]


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user.get("role") == "restaurant" and order["restaurant_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    return serialize(order)


@api_router.put("/orders/{order_id}/confirm")
async def confirm_order(order_id: str, data: OrderConfirmInput, user: dict = Depends(require_admin)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    items = []
    total = 0.0
    for it in data.items:
        amount = round(it.rate * it.qty, 2)
        total += amount
        items.append({
            "vegetable_id": it.vegetable_id,
            "name": it.name,
            "unit": it.unit,
            "qty": it.qty,
            "rate": it.rate,
            "amount": amount,
        })
    update = {
        "items": items,
        "total": round(total, 2),
        "status": data.status or "confirmed",
        "confirmed_at": now_utc().isoformat(),
    }
    if data.notes is not None:
        update["notes"] = data.notes
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update})
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize(doc)


@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user: dict = Depends(require_admin)):
    if status not in ["pending", "confirmed", "delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {"status": status}})
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize(doc)


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(require_admin)):
    res = await db.orders.delete_one({"_id": ObjectId(order_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Deleted"}


# ----------------------------- Restaurant (user) management -----------------------------
@api_router.get("/restaurants")
async def list_restaurants(status: Optional[str] = None, user: dict = Depends(require_admin)):
    query = {"role": "restaurant"}
    if status:
        query["status"] = status
    users = await db.users.find(query).sort("created_at", -1).to_list(1000)
    return [serialize(u) for u in users]


@api_router.post("/restaurants")
async def create_restaurant(data: RestaurantCreateInput, user: dict = Depends(require_admin)):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "name": data.name,
        "email": email,
        "password_hash": hash_password(data.password),
        "phone": data.phone or "",
        "address": data.address or "",
        "role": "restaurant",
        "status": "active",
        "created_at": now_utc().isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@api_router.put("/restaurants/{rid}")
async def update_restaurant(rid: str, data: RestaurantUpdateInput, user: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "password" in update:
        update["password_hash"] = hash_password(update.pop("password"))
    if update:
        await db.users.update_one({"_id": ObjectId(rid)}, {"$set": update})
    doc = await db.users.find_one({"_id": ObjectId(rid)})
    return serialize(doc)


@api_router.delete("/restaurants/{rid}")
async def delete_restaurant(rid: str, user: dict = Depends(require_admin)):
    await db.users.delete_one({"_id": ObjectId(rid), "role": "restaurant"})
    # Cascade clean related records to avoid orphaned orders/payments skewing stats
    await db.orders.delete_many({"restaurant_id": rid})
    await db.payments.delete_many({"restaurant_id": rid})
    return {"message": "Deleted"}


# ----------------------------- Payments & Ledger -----------------------------
@api_router.post("/payments")
async def add_payment(data: PaymentInput, user: dict = Depends(require_admin)):
    rest = await db.users.find_one({"_id": ObjectId(data.restaurant_id)})
    if not rest:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    doc = {
        "restaurant_id": data.restaurant_id,
        "restaurant_name": rest["name"],
        "amount": round(data.amount, 2),
        "note": data.note or "",
        "created_at": now_utc().isoformat(),
    }
    res = await db.payments.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


async def _ledger_for(restaurant_id: str):
    # billed = confirmed + delivered orders
    orders = await db.orders.find({
        "restaurant_id": restaurant_id,
        "status": {"$in": ["confirmed", "delivered"]},
    }).to_list(5000)
    billed = round(sum(float(o.get("total", 0)) for o in orders), 2)
    payments = await db.payments.find({"restaurant_id": restaurant_id}).to_list(5000)
    paid = round(sum(float(p.get("amount", 0)) for p in payments), 2)
    return billed, paid, round(billed - paid, 2)


@api_router.get("/ledger/{restaurant_id}")
async def get_ledger(restaurant_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") == "restaurant" and str(user["_id"]) != restaurant_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    billed, paid, pending = await _ledger_for(restaurant_id)
    orders = await db.orders.find({"restaurant_id": restaurant_id}).sort("created_at", -1).to_list(5000)
    payments = await db.payments.find({"restaurant_id": restaurant_id}).sort("created_at", -1).to_list(5000)
    return {
        "billed": billed,
        "paid": paid,
        "pending": pending,
        "orders": [serialize(o) for o in orders],
        "payments": [serialize(p) for p in payments],
    }


# ----------------------------- Dashboards -----------------------------
@api_router.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    all_orders = await db.orders.find({}).to_list(10000)
    total_orders = len(all_orders)
    today = today_str()
    today_orders = [o for o in all_orders if o.get("order_date") == today]
    pending_orders = [o for o in all_orders if o.get("status") == "pending"]
    billed_orders = [o for o in all_orders if o.get("status") in ["confirmed", "delivered"]]
    total_bill_value = round(sum(float(o.get("total", 0)) for o in billed_orders), 2)

    payments = await db.payments.find({}).to_list(10000)
    total_paid = round(sum(float(p.get("amount", 0)) for p in payments), 2)
    total_pending = round(total_bill_value - total_paid, 2)

    restaurants = await db.users.count_documents({"role": "restaurant"})
    pending_approvals = await db.users.count_documents({"role": "restaurant", "status": "pending"})

    # recent orders
    recent = sorted(all_orders, key=lambda o: o.get("created_at", ""), reverse=True)[:8]

    # last 7 days order value
    chart = []
    for i in range(6, -1, -1):
        d = (now_utc().date() - timedelta(days=i)).isoformat()
        day_orders = [o for o in all_orders if o.get("order_date") == d]
        day_value = round(sum(float(o.get("total", 0)) for o in day_orders), 2)
        chart.append({"date": d[5:], "orders": len(day_orders), "value": day_value})

    return {
        "total_orders": total_orders,
        "today_orders": len(today_orders),
        "today_value": round(sum(float(o.get("total", 0)) for o in today_orders), 2),
        "pending_orders": len(pending_orders),
        "total_bill_value": total_bill_value,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "restaurants": restaurants,
        "pending_approvals": pending_approvals,
        "recent_orders": [serialize(o) for o in recent],
        "chart": chart,
    }


@api_router.get("/admin/purchase-list")
async def purchase_list(delivery_date: Optional[str] = None, user: dict = Depends(require_admin)):
    target = delivery_date or tomorrow_str()
    orders = await db.orders.find({
        "delivery_date": target,
        "status": {"$in": ["pending", "confirmed"]},
    }).to_list(5000)
    agg = {}
    restaurants = set()
    for o in orders:
        restaurants.add(o.get("restaurant_name"))
        for it in o.get("items", []):
            key = it["vegetable_id"]
            if key not in agg:
                agg[key] = {
                    "vegetable_id": key,
                    "name": it["name"],
                    "unit": it.get("unit", "kg"),
                    "total_qty": 0.0,
                    "est_amount": 0.0,
                    "rate": float(it.get("rate", 0)),
                    "restaurants": set(),
                }
            agg[key]["total_qty"] += float(it.get("qty", 0))
            agg[key]["est_amount"] += float(it.get("amount", 0))
            agg[key]["restaurants"].add(o.get("restaurant_name"))
    items = [{
        "vegetable_id": v["vegetable_id"],
        "name": v["name"],
        "unit": v["unit"],
        "total_qty": round(v["total_qty"], 2),
        "rate": v["rate"],
        "est_amount": round(v["est_amount"], 2),
        "restaurants": len(v["restaurants"]),
    } for v in agg.values()]
    items.sort(key=lambda x: x["name"])
    return {
        "date": target,
        "order_count": len(orders),
        "restaurant_count": len(restaurants),
        "total_amount": round(sum(i["est_amount"] for i in items), 2),
        "items": items,
    }


@api_router.get("/admin/ledgers")
async def all_ledgers(user: dict = Depends(require_admin)):
    restaurants = await db.users.find({"role": "restaurant"}).sort("name", 1).to_list(1000)
    result = []
    for r in restaurants:
        billed, paid, pending = await _ledger_for(str(r["_id"]))
        rs = serialize(r)
        result.append({
            "id": rs["id"],
            "name": rs["name"],
            "email": rs["email"],
            "phone": rs.get("phone", ""),
            "status": rs.get("status"),
            "billed": billed,
            "paid": paid,
            "pending": pending,
        })
    return result


@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await get_settings_doc()
    locked, now_local = compute_lock(doc)
    return {
        "cutoff_enabled": doc.get("cutoff_enabled", False),
        "cutoff_time": doc.get("cutoff_time", "20:00"),
        "timezone": doc.get("timezone", DEFAULT_TZ),
        "is_locked": locked,
        "server_time": now_local.strftime("%H:%M"),
    }


@api_router.put("/settings")
async def update_settings(data: SettingsUpdate, user: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "cutoff_time" in update:
        try:
            hh, mm = (int(x) for x in str(update["cutoff_time"]).split(":"))
            assert 0 <= hh < 24 and 0 <= mm < 60
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid time. Use HH:MM (24-hour).")
    await db.settings.update_one({"_id": "global"}, {"$set": update}, upsert=True)
    doc = await get_settings_doc()
    locked, now_local = compute_lock(doc)
    return {
        "cutoff_enabled": doc.get("cutoff_enabled", False),
        "cutoff_time": doc.get("cutoff_time", "20:00"),
        "timezone": doc.get("timezone", DEFAULT_TZ),
        "is_locked": locked,
        "server_time": now_local.strftime("%H:%M"),
    }


@api_router.get("/")
async def root():
    return {"message": "Jivdani Vegetable Suppliers API"}


# ----------------------------- Supplier Routes -----------------------------
@api_router.get("/suppliers")
async def list_suppliers(user: dict = Depends(require_admin)):
    suppliers = await db.suppliers.find({}).sort("name", 1).to_list(1000)
    return [serialize(s) for s in suppliers]


@api_router.post("/suppliers")
async def create_supplier(data: SupplierInput, user: dict = Depends(require_admin)):
    doc = {"_id": str(uuid.uuid4()), **data.model_dump(), "created_at": now_utc().isoformat()}
    await db.suppliers.insert_one(doc)
    return serialize(doc)


@api_router.put("/suppliers/{sid}")
async def update_supplier(sid: str, data: SupplierUpdateInput, user: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.suppliers.update_one({"_id": sid}, {"$set": update})
    doc = await db.suppliers.find_one({"_id": sid})
    if not doc:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return serialize(doc)


@api_router.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, user: dict = Depends(require_admin)):
    bills = await db.purchase_bills.find({"supplier_id": sid}, {"_id": 1}).to_list(1000)
    bill_ids = [b["_id"] for b in bills]
    await db.purchase_bills.delete_many({"supplier_id": sid})
    if bill_ids:
        await db.supplier_payments.delete_many({"bill_id": {"$in": bill_ids}})
    await db.supplier_payments.delete_many({"supplier_id": sid})
    await db.suppliers.delete_one({"_id": sid})
    return {"message": "Deleted"}


# ----------------------------- Purchase Bill Routes -----------------------------
@api_router.get("/purchase-bills")
async def list_purchase_bills(supplier_id: Optional[str] = None, user: dict = Depends(require_admin)):
    query = {}
    if supplier_id:
        query["supplier_id"] = supplier_id
    bills = await db.purchase_bills.find(query).sort("bill_date", -1).to_list(2000)
    # Enrich each bill with payment summary
    bill_ids = [b["_id"] for b in bills]
    # Fetch all payments for these bills in one query
    payments_cursor = await db.supplier_payments.find({"bill_id": {"$in": bill_ids}}).to_list(10000)
    # Build a map: bill_id -> list of payments
    pay_map: dict = {}
    for p in payments_cursor:
        bid = p.get("bill_id", "")
        pay_map.setdefault(bid, []).append(p)

    result = []
    for b in bills:
        sb = serialize(b)
        bill_pays = pay_map.get(sb["id"], [])
        paid_amount = round(sum(float(p.get("amount", 0)) for p in bill_pays), 2)
        sb["paid_amount"] = paid_amount
        sb["remaining"] = round(sb["total"] - paid_amount, 2)
        result.append(sb)
    return result


@api_router.post("/purchase-bills")
async def create_purchase_bill(data: PurchaseBillInput, user: dict = Depends(require_admin)):
    supplier = await db.suppliers.find_one({"_id": data.supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    items = []
    total = 0.0
    for it in data.items:
        amount = round(it.rate * it.qty, 2)
        total += amount
        items.append({"name": it.name, "qty": it.qty, "unit": it.unit, "rate": it.rate, "amount": amount})
    doc = {
        "_id": str(uuid.uuid4()),
        "supplier_id": data.supplier_id,
        "supplier_name": supplier["name"],
        "bill_no": data.bill_no or "",
        "bill_date": data.bill_date,
        "items": items,
        "total": round(total, 2),
        "paid": False,
        "notes": data.notes or "",
        "created_at": now_utc().isoformat(),
    }
    await db.purchase_bills.insert_one(doc)
    return serialize(doc)


@api_router.put("/purchase-bills/{bid}")
async def update_purchase_bill(bid: str, data: PurchaseBillUpdateInput, user: dict = Depends(require_admin)):
    update: dict = {}
    if data.bill_no is not None:
        update["bill_no"] = data.bill_no
    if data.bill_date is not None:
        update["bill_date"] = data.bill_date
    if data.notes is not None:
        update["notes"] = data.notes
    if data.paid is not None:
        update["paid"] = data.paid
    if data.items is not None:
        items = []
        total = 0.0
        for it in data.items:
            amount = round(it.rate * it.qty, 2)
            total += amount
            items.append({"name": it.name, "qty": it.qty, "unit": it.unit, "rate": it.rate, "amount": amount})
        update["items"] = items
        update["total"] = round(total, 2)
    if update:
        await db.purchase_bills.update_one({"_id": bid}, {"$set": update})
    doc = await db.purchase_bills.find_one({"_id": bid})
    if not doc:
        raise HTTPException(status_code=404, detail="Bill not found")
    return serialize(doc)


@api_router.delete("/purchase-bills/{bid}")
async def delete_purchase_bill(bid: str, user: dict = Depends(require_admin)):
    await db.purchase_bills.delete_one({"_id": bid})
    await db.supplier_payments.delete_many({"bill_id": bid})
    return {"message": "Deleted"}


# ----------------------------- Supplier Payments -----------------------------
@api_router.get("/supplier-payments")
async def list_supplier_payments(supplier_id: Optional[str] = None, bill_id: Optional[str] = None, user: dict = Depends(require_admin)):
    query = {}
    if supplier_id:
        query["supplier_id"] = supplier_id
    if bill_id:
        query["bill_id"] = bill_id
    payments = await db.supplier_payments.find(query).sort("payment_date", -1).to_list(2000)
    return [serialize(p) for p in payments]


@api_router.post("/supplier-payments")
async def add_supplier_payment(data: SupplierPaymentInput, user: dict = Depends(require_admin)):
    supplier = await db.suppliers.find_one({"_id": data.supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    doc = {
        "_id": str(uuid.uuid4()),
        "supplier_id": data.supplier_id,
        "supplier_name": supplier["name"],
        "bill_id": data.bill_id or "",
        "amount": round(data.amount, 2),
        "note": data.note or "",
        "payment_date": data.payment_date or today_str(),
        "created_at": now_utc().isoformat(),
    }
    await db.supplier_payments.insert_one(doc)
    return serialize(doc)


@api_router.delete("/supplier-payments/{pid}")
async def delete_supplier_payment(pid: str, user: dict = Depends(require_admin)):
    await db.supplier_payments.delete_one({"_id": pid})
    return {"message": "Deleted"}


# ----------------------------- Expense Routes -----------------------------
@api_router.get("/expenses")
async def list_expenses(month: Optional[str] = None, user: dict = Depends(require_admin)):
    query: dict = {}
    if month:
        query["expense_date"] = {"$regex": f"^{month}"}
    expenses = await db.expenses.find(query).sort("expense_date", -1).to_list(2000)
    return [serialize(e) for e in expenses]


@api_router.post("/expenses")
async def create_expense(data: ExpenseInput, user: dict = Depends(require_admin)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    doc = {"_id": str(uuid.uuid4()), **data.model_dump(), "created_at": now_utc().isoformat()}
    await db.expenses.insert_one(doc)
    return serialize(doc)


@api_router.put("/expenses/{eid}")
async def update_expense(eid: str, data: ExpenseUpdateInput, user: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.expenses.update_one({"_id": eid}, {"$set": update})
    doc = await db.expenses.find_one({"_id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Expense not found")
    return serialize(doc)


@api_router.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(require_admin)):
    await db.expenses.delete_one({"_id": eid})
    return {"message": "Deleted"}


# ----------------------------- Reports -----------------------------
@api_router.get("/reports/monthly")
@limiter.limit("60/minute")
async def monthly_report(request: Request, year: int, month: int, user: dict = Depends(require_admin)):
    month_str = f"{year:04d}-{month:02d}"

    orders = await db.orders.find({
        "order_date": {"$regex": f"^{month_str}"},
        "status": {"$in": ["confirmed", "delivered"]},
    }).to_list(5000)
    revenue = round(sum(float(o.get("total", 0)) for o in orders), 2)

    payments = await db.payments.find({"created_at": {"$regex": f"^{month_str}"}}).to_list(5000)
    payments_received = round(sum(float(p.get("amount", 0)) for p in payments), 2)

    bills = await db.purchase_bills.find({"bill_date": {"$regex": f"^{month_str}"}}).to_list(5000)
    supplier_cost = round(sum(float(b.get("total", 0)) for b in bills), 2)

    sup_payments = await db.supplier_payments.find({"payment_date": {"$regex": f"^{month_str}"}}).to_list(5000)
    supplier_paid = round(sum(float(p.get("amount", 0)) for p in sup_payments), 2)

    expenses = await db.expenses.find({"expense_date": {"$regex": f"^{month_str}"}}).to_list(5000)
    total_expenses = round(sum(float(e.get("amount", 0)) for e in expenses), 2)

    exp_by_cat: dict = {}
    for e in expenses:
        cat = e.get("category", "Misc")
        exp_by_cat[cat] = round(exp_by_cat.get(cat, 0) + float(e.get("amount", 0)), 2)

    all_billed_orders = await db.orders.find({"status": {"$in": ["confirmed", "delivered"]}}).to_list(10000)
    all_billed = round(sum(float(o.get("total", 0)) for o in all_billed_orders), 2)
    all_recv = await db.payments.find({}).to_list(10000)
    all_paid = round(sum(float(p.get("amount", 0)) for p in all_recv), 2)

    return {
        "month": month_str,
        "revenue": revenue,
        "order_count": len(orders),
        "payments_received": payments_received,
        "pending_receivables": round(all_billed - all_paid, 2),
        "supplier_cost": supplier_cost,
        "supplier_paid": supplier_paid,
        "supplier_outstanding": round(supplier_cost - supplier_paid, 2),
        "expenses": total_expenses,
        "expense_breakdown": exp_by_cat,
        "gross_profit": round(revenue - supplier_cost - total_expenses, 2),
    }


@api_router.get("/reports/yearly")
@limiter.limit("60/minute")
async def yearly_report(request: Request, year: int, user: dict = Depends(require_admin)):
    months = []
    for m in range(1, 13):
        month_str = f"{year:04d}-{m:02d}"
        orders = await db.orders.find({
            "order_date": {"$regex": f"^{month_str}"},
            "status": {"$in": ["confirmed", "delivered"]},
        }).to_list(2000)
        revenue = round(sum(float(o.get("total", 0)) for o in orders), 2)
        payments = await db.payments.find({"created_at": {"$regex": f"^{month_str}"}}).to_list(2000)
        payments_received = round(sum(float(p.get("amount", 0)) for p in payments), 2)
        expenses = await db.expenses.find({"expense_date": {"$regex": f"^{month_str}"}}).to_list(2000)
        total_expenses = round(sum(float(e.get("amount", 0)) for e in expenses), 2)
        bills = await db.purchase_bills.find({"bill_date": {"$regex": f"^{month_str}"}}).to_list(2000)
        supplier_cost = round(sum(float(b.get("total", 0)) for b in bills), 2)
        months.append({
            "month": f"{m:02d}",
            "revenue": revenue,
            "payments_received": payments_received,
            "expenses": total_expenses,
            "supplier_cost": supplier_cost,
            "gross_profit": round(revenue - supplier_cost - total_expenses, 2),
        })
    return {"year": year, "months": months}

# ----------------------------- Startup seeding -----------------------------
DEFAULT_VEGETABLES = [
    {"name": "Tomato", "category": "Daily", "rate": 30},
    {"name": "Potato", "category": "Daily", "rate": 25},
    {"name": "Onion", "category": "Daily", "rate": 35},
    {"name": "Cauliflower", "category": "Daily", "rate": 40},
    {"name": "Cabbage", "category": "Daily", "rate": 20},
    {"name": "Green Chilli", "category": "Spices", "rate": 60},
    {"name": "Coriander", "category": "Leafy", "rate": 50},
    {"name": "Spinach (Palak)", "category": "Leafy", "rate": 30},
    {"name": "Capsicum", "category": "Daily", "rate": 55},
    {"name": "Brinjal (Baingan)", "category": "Daily", "rate": 35},
    {"name": "Lady Finger (Bhindi)", "category": "Daily", "rate": 45},
    {"name": "Carrot", "category": "Daily", "rate": 40},
    {"name": "Cucumber", "category": "Daily", "rate": 28},
    {"name": "Ginger", "category": "Spices", "rate": 120},
    {"name": "Garlic", "category": "Spices", "rate": 150},
    {"name": "Lemon", "category": "Daily", "rate": 80},
    {"name": "Green Peas", "category": "Daily", "rate": 70},
    {"name": "Beans", "category": "Daily", "rate": 50},
]


# ----------------------------- Demo Data Seeder -----------------------------
async def seed_demo_data():
    """Populate demodb with realistic sample data. Runs only when collections are empty."""
    if await db.restaurants.count_documents({}) > 0:
        logger.info("Demo data already present — skipping seed")
        return

    logger.info("Seeding demo database with sample data...")
    today = date.today()
    d = lambda days=0: (today - timedelta(days=days)).isoformat()

    # --- Vegetables ---
    veg_map = {}  # name -> _id
    async for v in db.vegetables.find():
        veg_map[v["name"]] = v["_id"]

    def veg(name): return veg_map.get(name, "")

    # --- Restaurants ---
    r1 = str(uuid.uuid4()); r2 = str(uuid.uuid4()); r3 = str(uuid.uuid4())
    demo_password = hash_password("Demo@2026")

    await db.restaurants.insert_many([
        {"_id": r1, "name": "Hotel Krishna Palace",  "address": "Sitabuldi, Nagpur", "phone": "9876543210", "status": "confirmed", "created_at": now_utc().isoformat()},
        {"_id": r2, "name": "Shree Ganesh Dhaba",    "address": "Dharampeth, Nagpur","phone": "9123456789", "status": "confirmed", "created_at": now_utc().isoformat()},
        {"_id": r3, "name": "Royal Veg Restaurant",  "address": "Itwari, Nagpur",    "phone": "9000011112", "status": "pending",   "created_at": now_utc().isoformat()},
    ])

    # Restaurant user accounts
    await db.users.insert_many([
        {"_id": str(uuid.uuid4()), "name": "Krishna Palace",  "email": "krishna@palace.com",  "password_hash": demo_password, "role": "restaurant", "restaurant_id": r1, "status": "active",  "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "name": "Ganesh Dhaba",    "email": "ganesh@dhaba.com",    "password_hash": demo_password, "role": "restaurant", "restaurant_id": r2, "status": "active",  "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "name": "Royal Veg",       "email": "royal@vegrest.com",   "password_hash": demo_password, "role": "restaurant", "restaurant_id": r3, "status": "pending", "created_at": now_utc().isoformat()},
    ])

    # --- Orders ---
    def make_item(name, qty, unit="kg"):
        rate = next((v["rate"] for v in DEFAULT_VEGETABLES if v["name"] == name), 30)
        return {"vegetable_id": veg(name), "name": name, "qty": qty, "unit": unit, "rate": rate, "amount": round(qty * rate, 2)}

    orders = [
        {"_id": str(uuid.uuid4()), "restaurant_id": r1, "restaurant_name": "Hotel Krishna Palace",
         "items": [make_item("Tomato", 10), make_item("Potato", 20), make_item("Onion", 15)],
         "delivery_date": d(0), "status": "pending",   "notes": "Deliver before 8 AM", "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "restaurant_id": r2, "restaurant_name": "Shree Ganesh Dhaba",
         "items": [make_item("Capsicum", 5), make_item("Cauliflower", 8), make_item("Green Peas", 6)],
         "delivery_date": d(0), "status": "confirmed", "notes": "", "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "restaurant_id": r1, "restaurant_name": "Hotel Krishna Palace",
         "items": [make_item("Coriander", 3), make_item("Spinach (Palak)", 4), make_item("Green Chilli", 2)],
         "delivery_date": d(1), "status": "delivered", "notes": "", "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "restaurant_id": r2, "restaurant_name": "Shree Ganesh Dhaba",
         "items": [make_item("Ginger", 2), make_item("Garlic", 3), make_item("Lemon", 5)],
         "delivery_date": d(2), "status": "delivered", "notes": "", "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "restaurant_id": r1, "restaurant_name": "Hotel Krishna Palace",
         "items": [make_item("Lady Finger (Bhindi)", 7), make_item("Brinjal (Baingan)", 6), make_item("Carrot", 8)],
         "delivery_date": d(3), "status": "delivered", "notes": "", "created_at": now_utc().isoformat()},
    ]
    # Set totals
    for o in orders:
        o["total"] = round(sum(i["amount"] for i in o["items"]), 2)
    await db.orders.insert_many(orders)

    # Payments for delivered orders
    for o in orders:
        if o["status"] == "delivered":
            await db.payments.insert_one({
                "_id": str(uuid.uuid4()),
                "restaurant_id": o["restaurant_id"],
                "restaurant_name": o["restaurant_name"],
                "order_id": o["_id"],
                "amount": o["total"],
                "payment_date": d(0),
                "note": "Cash",
                "created_at": now_utc().isoformat(),
            })

    # --- Suppliers ---
    s1 = str(uuid.uuid4()); s2 = str(uuid.uuid4())
    await db.suppliers.insert_many([
        {"_id": s1, "name": "Nagpur Sabji Mandi", "phone": "9988776655", "address": "Cotton Market, Nagpur", "notes": "Reliable daily supplier", "created_at": now_utc().isoformat()},
        {"_id": s2, "name": "Wardha Road Farms",  "phone": "9876001234", "address": "Wardha Road, Nagpur",   "notes": "Organic produce", "created_at": now_utc().isoformat()},
    ])

    # --- Purchase Bills ---
    b1 = str(uuid.uuid4()); b2 = str(uuid.uuid4()); b3 = str(uuid.uuid4())
    await db.purchase_bills.insert_many([
        {"_id": b1, "supplier_id": s1, "supplier_name": "Nagpur Sabji Mandi", "bill_no": "NM-001",
         "bill_date": d(3), "items": [{"name": "Tomato", "qty": 50, "unit": "kg", "rate": 28, "amount": 1400}, {"name": "Potato", "qty": 40, "unit": "kg", "rate": 22, "amount": 880}],
         "total": 2280.0, "paid": False, "notes": "", "created_at": now_utc().isoformat()},
        {"_id": b2, "supplier_id": s1, "supplier_name": "Nagpur Sabji Mandi", "bill_no": "NM-002",
         "bill_date": d(1), "items": [{"name": "Onion", "qty": 30, "unit": "kg", "rate": 32, "amount": 960}, {"name": "Capsicum", "qty": 10, "unit": "kg", "rate": 50, "amount": 500}],
         "total": 1460.0, "paid": True,  "notes": "", "created_at": now_utc().isoformat()},
        {"_id": b3, "supplier_id": s2, "supplier_name": "Wardha Road Farms", "bill_no": "WF-001",
         "bill_date": d(2), "items": [{"name": "Spinach (Palak)", "qty": 20, "unit": "kg", "rate": 28, "amount": 560}, {"name": "Coriander", "qty": 15, "unit": "kg", "rate": 45, "amount": 675}],
         "total": 1235.0, "paid": False, "notes": "Organic batch", "created_at": now_utc().isoformat()},
    ])

    # --- Supplier Payments ---
    await db.supplier_payments.insert_many([
        {"_id": str(uuid.uuid4()), "supplier_id": s1, "bill_id": b1, "amount": 1500.0, "payment_date": d(1), "note": "Advance cash", "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "supplier_id": s1, "bill_id": b2, "amount": 1460.0, "payment_date": d(0), "note": "Full payment - NEFT", "created_at": now_utc().isoformat()},
    ])

    # --- Expenses ---
    await db.expenses.insert_many([
        {"_id": str(uuid.uuid4()), "category": "Transport",  "amount": 1200.0, "description": "Diesel for delivery van",   "date": d(1), "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "category": "Maintenance","amount": 3500.0, "description": "Vehicle service & repair",  "date": d(5), "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "category": "Supplies",   "amount":  450.0, "description": "Packing materials & bags",  "date": d(2), "created_at": now_utc().isoformat()},
        {"_id": str(uuid.uuid4()), "category": "Labour",     "amount": 2400.0, "description": "Helper wages (weekly)",      "date": d(0), "created_at": now_utc().isoformat()},
    ])

    logger.info("Demo data seeded successfully")
    logger.info("  Demo restaurant logins: krishna@palace.com / ganesh@dhaba.com  (password: Demo@2026)")


@app.on_event("startup")
async def startup():
    # Wait for MongoDB to be reachable (resilient against startup race / restart)
    import asyncio
    max_attempts = 30
    for attempt in range(1, max_attempts + 1):
        try:
            await client.admin.command("ping")
            logger.info(f"MongoDB reachable on attempt {attempt}")
            break
        except Exception as e:
            if attempt == max_attempts:
                logger.error(f"MongoDB unreachable after {max_attempts} attempts: {e}")
                raise
            logger.warning(f"MongoDB not ready (attempt {attempt}/{max_attempts}): {e}")
            await asyncio.sleep(2)

    await db.users.create_index("email", unique=True)
    await db.orders.create_index("restaurant_id")
    await db.orders.create_index("status")

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    reset_flag = os.environ.get("ADMIN_PASSWORD_RESET", "").strip().lower() in ("1", "true", "yes")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "name": "Jivdani Admin",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "status": "active",
            "created_at": now_utc().isoformat(),
        })
        logger.info("Seeded admin user")
    elif reset_flag:
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        logger.warning("ADMIN_PASSWORD_RESET flag set — admin password reset to ADMIN_PASSWORD from env")
    else:
        logger.info("Admin user already exists — keeping current DB password (env ADMIN_PASSWORD ignored)")

    if await db.vegetables.count_documents({}) == 0:
        for v in DEFAULT_VEGETABLES:
            await db.vegetables.insert_one({
                "_id": str(uuid.uuid4()),
                "name": v["name"],
                "unit": "kg",
                "category": v["category"],
                "rate": v["rate"],
                "active": True,
                "image": "",
                "created_at": now_utc().isoformat(),
            })
        logger.info("Seeded default vegetables")

    if IS_DEMO:
        logger.info("DEMO mode active — using database: demodb")
        await seed_demo_data()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
