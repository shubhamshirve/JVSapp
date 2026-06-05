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
        for key in ("rest_id", "self_reg_id"):
            rid = state.get(key)
            if rid:
                requests.delete(f"{API}/restaurants/{rid}", headers=h, timeout=10)
    except Exception:
        pass
