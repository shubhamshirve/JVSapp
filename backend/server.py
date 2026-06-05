from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict, BeforeValidator
from typing import List, Optional, Annotated, Any
from datetime import datetime, timezone, date, timedelta
from bson import ObjectId
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI(title="Jivdani Vegetable Suppliers")
api_router = APIRouter(prefix="/api")

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


# ----------------------------- Auth Routes -----------------------------
@api_router.post("/auth/register")
async def register(data: RegisterInput):
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
async def login(data: LoginInput):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), user["role"])
    return {"token": token, "user": serialize(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize(user)


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
async def create_order(data: OrderCreateInput, user: dict = Depends(require_active_restaurant)):
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


@api_router.get("/")
async def root():
    return {"message": "Jivdani Vegetable Suppliers API"}


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


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.orders.create_index("restaurant_id")
    await db.orders.create_index("status")

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
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
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    if await db.vegetables.count_documents({}) == 0:
        for v in DEFAULT_VEGETABLES:
            await db.vegetables.insert_one({
                "name": v["name"],
                "unit": "kg",
                "category": v["category"],
                "rate": v["rate"],
                "active": True,
                "image": "",
                "created_at": now_utc().isoformat(),
            })
        logger.info("Seeded default vegetables")


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
