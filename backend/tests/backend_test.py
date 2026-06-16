"""
Backend tests for Jivdani Vegetable Suppliers
Covers: auth, vegetables, rates, restaurants, orders (create/confirm/status),
payments, ledger, admin stats, role separation.
"""
import os
import time
import uuid
import requests
import pytest
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@jivdani.com"
ADMIN_PASSWORD = "Jivdani@2026"

# Unique restaurant per test session to avoid collisions across runs
UNIQUE = uuid.uuid4().hex[:8]
SELF_REG_EMAIL = f"test_selfreg_{UNIQUE}@test.com"
ADMIN_CREATED_EMAIL = f"test_spicegarden_{UNIQUE}@test.com"
REST_PASSWORD = "Test@1234"


# ----------------------------- helpers -----------------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    return r


@pytest.fixture(scope="session")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def state():
    """Shared dictionary to pass IDs between tests."""
    return {}


# ----------------------------- Auth -----------------------------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_invalid(self):
        r = _login(ADMIN_EMAIL, "wrongpass")
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_admin(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "password_hash" not in data


# ----------------------------- Self-registration -----------------------------
class TestSelfRegistration:
    def test_self_register(self, state):
        r = requests.post(f"{API}/auth/register", json={
            "name": "Self Reg Restaurant",
            "email": SELF_REG_EMAIL,
            "password": REST_PASSWORD,
            "phone": "9999999999",
            "address": "Some address",
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "awaiting" in data["message"].lower() or "approval" in data["message"].lower()
        assert data["user"]["status"] == "pending"
        state["self_reg_id"] = data["user"]["id"]

    def test_duplicate_registration(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "Dup", "email": SELF_REG_EMAIL, "password": REST_PASSWORD,
        }, timeout=10)
        assert r.status_code == 400

    def test_pending_login_then_cannot_order(self):
        # Pending user can log in (frontend shows PendingApproval screen)
        r = _login(SELF_REG_EMAIL, REST_PASSWORD)
        assert r.status_code == 200
        token = r.json()["token"]
        # But cannot create orders
        r2 = requests.post(f"{API}/orders",
                           headers={"Authorization": f"Bearer {token}"},
                           json={"items": [], "notes": ""}, timeout=10)
        assert r2.status_code == 403


# ----------------------------- Admin creates restaurant -----------------------------
class TestAdminRestaurantMgmt:
    def test_admin_create_restaurant_active(self, admin_headers, state):
        r = requests.post(f"{API}/restaurants", headers=admin_headers, json={
            "name": "Spice Garden",
            "email": ADMIN_CREATED_EMAIL,
            "password": REST_PASSWORD,
            "phone": "8888888888",
            "address": "Test address",
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "active"
        assert data["email"] == ADMIN_CREATED_EMAIL
        state["rest_id"] = data["id"]

        # GET verification via list
        rl = requests.get(f"{API}/restaurants", headers=admin_headers, timeout=10)
        assert rl.status_code == 200
        emails = [u["email"] for u in rl.json()]
        assert ADMIN_CREATED_EMAIL in emails

    def test_approve_pending_restaurant(self, admin_headers, state):
        rid = state["self_reg_id"]
        r = requests.put(f"{API}/restaurants/{rid}", headers=admin_headers,
                         json={"status": "active"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "active"

    def test_restaurant_role_separation(self, state):
        # restaurant token cannot hit admin endpoints
        r = _login(ADMIN_CREATED_EMAIL, REST_PASSWORD)
        assert r.status_code == 200
        token = r.json()["token"]
        state["rest_token"] = token
        h = {"Authorization": f"Bearer {token}"}
        assert requests.get(f"{API}/admin/stats", headers=h, timeout=10).status_code == 403
        assert requests.get(f"{API}/restaurants", headers=h, timeout=10).status_code == 403
        assert requests.get(f"{API}/admin/ledgers", headers=h, timeout=10).status_code == 403


# ----------------------------- Vegetables / Rates -----------------------------
class TestVegetables:
    def test_list_vegetables_seeded(self, admin_headers, state):
        r = requests.get(f"{API}/vegetables", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        vegs = r.json()
        assert len(vegs) >= 18
        state["vegs"] = vegs

    def test_create_update_delete_vegetable(self, admin_headers):
        # CREATE
        r = requests.post(f"{API}/vegetables", headers=admin_headers, json={
            "name": f"TEST_Veg_{UNIQUE}", "unit": "kg", "category": "Daily",
            "rate": 99.0, "active": True,
        }, timeout=10)
        assert r.status_code == 200, r.text
        vid = r.json()["id"]
        # UPDATE
        r = requests.put(f"{API}/vegetables/{vid}", headers=admin_headers,
                         json={"rate": 111.0, "active": False}, timeout=10)
        assert r.status_code == 200
        assert r.json()["rate"] == 111.0
        assert r.json()["active"] is False
        # DELETE
        r = requests.delete(f"{API}/vegetables/{vid}", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_bulk_rate_update(self, admin_headers, state):
        # pick two vegetables and bump rate
        target = state["vegs"][:2]
        new_rates = [{"vegetable_id": v["id"], "rate": 77.5} for v in target]
        r = requests.post(f"{API}/vegetables/rates/bulk", headers=admin_headers,
                          json={"rates": new_rates}, timeout=10)
        assert r.status_code == 200
        assert r.json()["count"] == 2
        # Verify persisted
        r2 = requests.get(f"{API}/vegetables", headers=admin_headers, timeout=10)
        assert r2.status_code == 200
        by_id = {v["id"]: v for v in r2.json()}
        for v in target:
            assert by_id[v["id"]]["rate"] == 77.5


# ----------------------------- Orders flow -----------------------------
class TestOrders:
    def test_restaurant_create_order(self, state):
        h = {"Authorization": f"Bearer {state['rest_token']}"}
        vegs = state["vegs"][:3]
        items = [{"vegetable_id": v["id"], "qty": 2.5} for v in vegs]
        r = requests.post(f"{API}/orders", headers=h,
                          json={"items": items, "notes": "morning order"}, timeout=15)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "pending"
        assert order["total"] > 0
        assert len(order["items"]) == 3
        state["order_id"] = order["id"]
        state["order_total"] = order["total"]

    def test_restaurant_lists_own_orders(self, state):
        h = {"Authorization": f"Bearer {state['rest_token']}"}
        r = requests.get(f"{API}/orders", headers=h, timeout=10)
        assert r.status_code == 200
        ids = [o["id"] for o in r.json()]
        assert state["order_id"] in ids

    def test_admin_confirm_order(self, admin_headers, state):
        # fetch order, tweak qty and rate
        order_id = state["order_id"]
        r = requests.get(f"{API}/orders/{order_id}", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        confirm_items = []
        for it in items:
            confirm_items.append({
                "vegetable_id": it["vegetable_id"],
                "name": it["name"],
                "unit": it["unit"],
                "qty": it["qty"] + 0.5,
                "rate": it["rate"] + 1.0,
            })
        r = requests.put(f"{API}/orders/{order_id}/confirm", headers=admin_headers,
                         json={"items": confirm_items, "status": "confirmed"}, timeout=15)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["status"] == "confirmed"
        # total recalculated
        expected = round(sum((it["qty"] + 0.5) * (it["rate"] + 1.0) for it in items), 2)
        assert abs(c["total"] - expected) < 0.5
        state["confirmed_total"] = c["total"]

    def test_admin_mark_delivered(self, admin_headers, state):
        r = requests.put(f"{API}/orders/{state['order_id']}/status",
                         headers=admin_headers, params={"status": "delivered"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "delivered"

    def test_invalid_status(self, admin_headers, state):
        r = requests.put(f"{API}/orders/{state['order_id']}/status",
                         headers=admin_headers, params={"status": "bogus"}, timeout=10)
        assert r.status_code == 400

    def test_empty_order_rejected(self, state):
        h = {"Authorization": f"Bearer {state['rest_token']}"}
        r = requests.post(f"{API}/orders", headers=h, json={"items": []}, timeout=10)
        assert r.status_code == 400


# ----------------------------- Ledger & payments -----------------------------
class TestLedger:
    def test_ledger_after_delivery(self, admin_headers, state):
        rid = state["rest_id"]
        r = requests.get(f"{API}/ledger/{rid}", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        led = r.json()
        assert led["billed"] >= state["confirmed_total"] - 0.5
        assert led["pending"] == round(led["billed"] - led["paid"], 2)
        state["billed_before"] = led["billed"]

    def test_record_payment(self, admin_headers, state):
        rid = state["rest_id"]
        pay_amt = round(state["confirmed_total"] / 2, 2)
        r = requests.post(f"{API}/payments", headers=admin_headers, json={
            "restaurant_id": rid, "amount": pay_amt, "note": "partial",
        }, timeout=10)
        assert r.status_code == 200
        # verify ledger reduced
        r2 = requests.get(f"{API}/ledger/{rid}", headers=admin_headers, timeout=10)
        assert r2.status_code == 200
        led = r2.json()
        assert led["paid"] >= pay_amt - 0.01
        assert led["pending"] == round(led["billed"] - led["paid"], 2)

    def test_restaurant_can_see_own_ledger(self, state):
        h = {"Authorization": f"Bearer {state['rest_token']}"}
        r = requests.get(f"{API}/ledger/{state['rest_id']}", headers=h, timeout=10)
        assert r.status_code == 200

    def test_restaurant_cannot_see_other_ledger(self, state):
        h = {"Authorization": f"Bearer {state['rest_token']}"}
        other_id = state.get("self_reg_id")
        r = requests.get(f"{API}/ledger/{other_id}", headers=h, timeout=10)
        assert r.status_code == 403


# ----------------------------- Admin Stats & Ledgers -----------------------------
class TestAdminDashboards:
    def test_admin_stats(self, admin_headers):
        r = requests.get(f"{API}/admin/stats", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        for k in ["total_orders", "today_value", "pending_orders", "total_bill_value",
                  "total_pending", "restaurants", "chart"]:
            assert k in data
        assert len(data["chart"]) == 7

    def test_admin_ledgers(self, admin_headers, state):
        r = requests.get(f"{API}/admin/ledgers", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        ledgers = r.json()
        ids = [l["id"] for l in ledgers]
        assert state["rest_id"] in ids


# ----------------------------- Suppliers CRUD -----------------------------
class TestSuppliers:
    def test_create_supplier(self, admin_headers, state):
        r = requests.post(f"{API}/suppliers", headers=admin_headers, json={
            "name": "Fresh Farms",
            "phone": "9876543210",
            "address": "Mumbai Market",
            "notes": "Reliable supplier"
        }, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Fresh Farms"
        assert data["phone"] == "9876543210"
        assert "id" in data
        state["supplier_id"] = data["id"]

    def test_list_suppliers(self, admin_headers, state):
        r = requests.get(f"{API}/suppliers", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        suppliers = r.json()
        assert isinstance(suppliers, list)
        ids = [s["id"] for s in suppliers]
        assert state["supplier_id"] in ids

    def test_update_supplier(self, admin_headers, state):
        sid = state["supplier_id"]
        r = requests.put(f"{API}/suppliers/{sid}", headers=admin_headers, json={
            "name": "Fresh Farms Updated",
            "phone": "9876543211"
        }, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Fresh Farms Updated"
        assert data["phone"] == "9876543211"

    def test_supplier_requires_admin(self, state):
        # Restaurant user cannot access suppliers
        h = {"Authorization": f"Bearer {state['rest_token']}"}
        r = requests.get(f"{API}/suppliers", headers=h, timeout=10)
        assert r.status_code == 403


# ----------------------------- Purchase Bills CRUD -----------------------------
class TestPurchaseBills:
    def test_create_purchase_bill(self, admin_headers, state):
        from datetime import date
        today = date.today().isoformat()
        r = requests.post(f"{API}/purchase-bills", headers=admin_headers, json={
            "supplier_id": state["supplier_id"],
            "bill_no": "FB-001",
            "bill_date": today,
            "items": [
                {"name": "Tomato", "qty": 10, "unit": "kg", "rate": 30},
                {"name": "Onion", "qty": 15, "unit": "kg", "rate": 35}
            ],
            "notes": "Morning delivery"
        }, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["bill_no"] == "FB-001"
        assert len(data["items"]) == 2
        # Check total calculation: (10*30) + (15*35) = 300 + 525 = 825
        assert data["total"] == 825.0
        assert data["paid"] is False
        assert "id" in data
        state["bill_id"] = data["id"]
        state["bill_total"] = data["total"]

    def test_list_purchase_bills(self, admin_headers, state):
        r = requests.get(f"{API}/purchase-bills", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        bills = r.json()
        assert isinstance(bills, list)
        ids = [b["id"] for b in bills]
        assert state["bill_id"] in ids

    def test_list_bills_by_supplier(self, admin_headers, state):
        r = requests.get(f"{API}/purchase-bills", 
                        headers=admin_headers, 
                        params={"supplier_id": state["supplier_id"]},
                        timeout=10)
        assert r.status_code == 200
        bills = r.json()
        for bill in bills:
            assert bill["supplier_id"] == state["supplier_id"]

    def test_update_bill_mark_paid(self, admin_headers, state):
        bid = state["bill_id"]
        r = requests.put(f"{API}/purchase-bills/{bid}", headers=admin_headers, json={
            "paid": True
        }, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["paid"] is True

    def test_update_bill_items(self, admin_headers, state):
        # Create another bill to test item updates
        from datetime import date
        today = date.today().isoformat()
        r = requests.post(f"{API}/purchase-bills", headers=admin_headers, json={
            "supplier_id": state["supplier_id"],
            "bill_no": "FB-002",
            "bill_date": today,
            "items": [{"name": "Potato", "qty": 20, "unit": "kg", "rate": 25}]
        }, timeout=10)
        assert r.status_code == 200
        bid2 = r.json()["id"]
        
        # Update items
        r = requests.put(f"{API}/purchase-bills/{bid2}", headers=admin_headers, json={
            "items": [
                {"name": "Potato", "qty": 25, "unit": "kg", "rate": 25},
                {"name": "Carrot", "qty": 10, "unit": "kg", "rate": 40}
            ]
        }, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data["items"]) == 2
        # (25*25) + (10*40) = 625 + 400 = 1025
        assert data["total"] == 1025.0
        state["bill_id_2"] = bid2


# ----------------------------- Supplier Payments -----------------------------
class TestSupplierPayments:
    def test_create_supplier_payment(self, admin_headers, state):
        r = requests.post(f"{API}/supplier-payments", headers=admin_headers, json={
            "supplier_id": state["supplier_id"],
            "bill_id": state["bill_id"],
            "amount": 500,
            "note": "Cash payment"
        }, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 500.0
        assert data["supplier_id"] == state["supplier_id"]
        assert data["bill_id"] == state["bill_id"]
        assert "id" in data
        state["payment_id"] = data["id"]

    def test_list_supplier_payments(self, admin_headers, state):
        r = requests.get(f"{API}/supplier-payments", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        payments = r.json()
        assert isinstance(payments, list)
        ids = [p["id"] for p in payments]
        assert state["payment_id"] in ids

    def test_list_payments_by_supplier(self, admin_headers, state):
        r = requests.get(f"{API}/supplier-payments",
                        headers=admin_headers,
                        params={"supplier_id": state["supplier_id"]},
                        timeout=10)
        assert r.status_code == 200
        payments = r.json()
        for payment in payments:
            assert payment["supplier_id"] == state["supplier_id"]

    def test_payment_requires_valid_supplier(self, admin_headers):
        r = requests.post(f"{API}/supplier-payments", headers=admin_headers, json={
            "supplier_id": "invalid-id",
            "amount": 100,
            "note": "Test"
        }, timeout=10)
        assert r.status_code == 404

    def test_payment_requires_positive_amount(self, admin_headers, state):
        r = requests.post(f"{API}/supplier-payments", headers=admin_headers, json={
            "supplier_id": state["supplier_id"],
            "amount": -100,
            "note": "Test"
        }, timeout=10)
        assert r.status_code == 400


# ----------------------------- Expenses CRUD -----------------------------
class TestExpenses:
    def test_create_expense(self, admin_headers, state):
        r = requests.post(f"{API}/expenses", headers=admin_headers, json={
            "category": "Transport",
            "amount": 250,
            "expense_date": "2025-07-01",
            "bill_ref": "TRP-001",
            "notes": "Fuel for delivery"
        }, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["category"] == "Transport"
        assert data["amount"] == 250.0
        assert data["expense_date"] == "2025-07-01"
        assert "id" in data
        state["expense_id"] = data["id"]

    def test_list_expenses(self, admin_headers, state):
        r = requests.get(f"{API}/expenses", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        expenses = r.json()
        assert isinstance(expenses, list)
        ids = [e["id"] for e in expenses]
        assert state["expense_id"] in ids

    def test_list_expenses_by_month(self, admin_headers, state):
        # Create another expense for current month
        from datetime import date
        today = date.today()
        month_str = today.strftime("%Y-%m")
        
        r = requests.post(f"{API}/expenses", headers=admin_headers, json={
            "category": "Utilities",
            "amount": 150,
            "expense_date": today.isoformat(),
            "bill_ref": "UTIL-001",
            "notes": "Electricity"
        }, timeout=10)
        assert r.status_code == 200
        exp_id = r.json()["id"]
        state["expense_id_2"] = exp_id
        
        # Filter by month
        r = requests.get(f"{API}/expenses",
                        headers=admin_headers,
                        params={"month": month_str},
                        timeout=10)
        assert r.status_code == 200
        expenses = r.json()
        # All expenses should be from this month
        for exp in expenses:
            assert exp["expense_date"].startswith(month_str)

    def test_update_expense(self, admin_headers, state):
        eid = state["expense_id"]
        r = requests.put(f"{API}/expenses/{eid}", headers=admin_headers, json={
            "amount": 300,
            "notes": "Updated fuel cost"
        }, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 300.0
        assert data["notes"] == "Updated fuel cost"

    def test_expense_requires_positive_amount(self, admin_headers):
        r = requests.post(f"{API}/expenses", headers=admin_headers, json={
            "category": "Test",
            "amount": -50,
            "expense_date": "2025-07-01"
        }, timeout=10)
        assert r.status_code == 400

    def test_delete_expense(self, admin_headers, state):
        eid = state.get("expense_id_2")
        if eid:
            r = requests.delete(f"{API}/expenses/{eid}", headers=admin_headers, timeout=10)
            assert r.status_code == 200


# ----------------------------- Reports -----------------------------
class TestReports:
    def test_monthly_report(self, admin_headers):
        from datetime import date
        today = date.today()
        r = requests.get(f"{API}/reports/monthly",
                        headers=admin_headers,
                        params={"year": today.year, "month": today.month},
                        timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Check all required fields
        required_fields = [
            "month", "revenue", "order_count", "payments_received",
            "pending_receivables", "supplier_cost", "supplier_paid",
            "supplier_outstanding", "expenses", "expense_breakdown", "gross_profit"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Check data types
        assert isinstance(data["revenue"], (int, float))
        assert isinstance(data["order_count"], int)
        assert isinstance(data["expense_breakdown"], dict)
        
        # Gross profit calculation check
        expected_profit = data["revenue"] - data["supplier_cost"] - data["expenses"]
        assert abs(data["gross_profit"] - expected_profit) < 0.01

    def test_yearly_report(self, admin_headers):
        from datetime import date
        today = date.today()
        r = requests.get(f"{API}/reports/yearly",
                        headers=admin_headers,
                        params={"year": today.year},
                        timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "year" in data
        assert "months" in data
        assert len(data["months"]) == 12
        
        # Check each month has required fields
        for month_data in data["months"]:
            assert "month" in month_data
            assert "revenue" in month_data
            assert "payments_received" in month_data
            assert "expenses" in month_data
            assert "supplier_cost" in month_data
            assert "gross_profit" in month_data
            
            # Verify gross profit calculation
            expected = month_data["revenue"] - month_data["supplier_cost"] - month_data["expenses"]
            assert abs(month_data["gross_profit"] - expected) < 0.01

    def test_reports_require_admin(self, state):
        from datetime import date
        today = date.today()
        h = {"Authorization": f"Bearer {state['rest_token']}"}
        
        r = requests.get(f"{API}/reports/monthly",
                        headers=h,
                        params={"year": today.year, "month": today.month},
                        timeout=10)
        assert r.status_code == 403
        
        r = requests.get(f"{API}/reports/yearly",
                        headers=h,
                        params={"year": today.year},
                        timeout=10)
        assert r.status_code == 403


# ----------------------------- Cascade Delete Test -----------------------------
class TestCascadeDelete:
    def test_supplier_delete_cascades(self, admin_headers, state):
        # Create a new supplier with bills and payments
        r = requests.post(f"{API}/suppliers", headers=admin_headers, json={
            "name": "Test Cascade Supplier",
            "phone": "1111111111"
        }, timeout=10)
        assert r.status_code == 200
        cascade_supplier_id = r.json()["id"]
        
        # Create a bill for this supplier
        from datetime import date
        r = requests.post(f"{API}/purchase-bills", headers=admin_headers, json={
            "supplier_id": cascade_supplier_id,
            "bill_no": "CASCADE-001",
            "bill_date": date.today().isoformat(),
            "items": [{"name": "Test", "qty": 1, "unit": "kg", "rate": 10}]
        }, timeout=10)
        assert r.status_code == 200
        cascade_bill_id = r.json()["id"]
        
        # Create a payment for this bill
        r = requests.post(f"{API}/supplier-payments", headers=admin_headers, json={
            "supplier_id": cascade_supplier_id,
            "bill_id": cascade_bill_id,
            "amount": 5
        }, timeout=10)
        assert r.status_code == 200
        cascade_payment_id = r.json()["id"]
        
        # Delete the supplier
        r = requests.delete(f"{API}/suppliers/{cascade_supplier_id}", 
                           headers=admin_headers, timeout=10)
        assert r.status_code == 200
        
        # Verify bill is deleted
        r = requests.get(f"{API}/purchase-bills", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        bill_ids = [b["id"] for b in r.json()]
        assert cascade_bill_id not in bill_ids
        
        # Verify payment is deleted
        r = requests.get(f"{API}/supplier-payments", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        payment_ids = [p["id"] for p in r.json()]
        assert cascade_payment_id not in payment_ids


# ----------------------------- Cleanup -----------------------------
@pytest.fixture(scope="session", autouse=True)
def _cleanup(state):
    yield
    # best-effort cleanup so reruns are idempotent
    try:
        r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if r.status_code != 200:
            return
        h = {"Authorization": f"Bearer {r.json()['token']}"}
        
        # Clean up restaurants
        for key in ("rest_id", "self_reg_id"):
            rid = state.get(key)
            if rid:
                requests.delete(f"{API}/restaurants/{rid}", headers=h, timeout=10)
        
        # Clean up test data
        if state.get("supplier_id"):
            requests.delete(f"{API}/suppliers/{state['supplier_id']}", headers=h, timeout=10)
        if state.get("expense_id"):
            requests.delete(f"{API}/expenses/{state['expense_id']}", headers=h, timeout=10)
    except Exception:
        pass
