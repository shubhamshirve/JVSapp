"""
Iteration 2 backend tests:
- GET /api/admin/purchase-list?delivery_date=YYYY-MM-DD aggregation
- DELETE /api/orders/{id} (admin only)
- PUT /api/restaurants/{id} update name/phone/address/password
"""
import os
import uuid
import requests
import pytest
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@jivdani.com"
ADMIN_PASSWORD = "Jivdani@2026"
REST_PASSWORD = "Test@1234"
UNIQUE = uuid.uuid4().hex[:8]


def tomorrow():
    return (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()


def day_after(n):
    return (datetime.now(timezone.utc).date() + timedelta(days=n)).isoformat()


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def vegs(admin_h):
    r = requests.get(f"{API}/vegetables", headers=admin_h, timeout=10)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def two_restaurants(admin_h):
    rs = []
    for i in (1, 2):
        email = f"test_pl{i}_{UNIQUE}@test.com"
        r = requests.post(f"{API}/restaurants", headers=admin_h, json={
            "name": f"TEST_PL_Rest{i}_{UNIQUE}",
            "email": email,
            "password": REST_PASSWORD,
            "phone": "9000000000",
            "address": "Addr",
        }, timeout=15)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        lr = requests.post(f"{API}/auth/login", json={"email": email, "password": REST_PASSWORD}, timeout=10)
        assert lr.status_code == 200
        token = lr.json()["token"]
        rs.append({"id": rid, "email": email, "token": token, "name": f"TEST_PL_Rest{i}_{UNIQUE}"})
    yield rs
    # cleanup
    for r in rs:
        try:
            requests.delete(f"{API}/restaurants/{r['id']}", headers=admin_h, timeout=10)
        except Exception:
            pass


class TestPurchaseList:
    def test_purchase_list_aggregates_across_restaurants(self, admin_h, vegs, two_restaurants):
        v_a, v_b, v_c = vegs[0], vegs[1], vegs[2]
        target_date = day_after(3)  # use a unique date in future to avoid noise

        # Rest1 orders v_a=2, v_b=3 for target_date
        h1 = {"Authorization": f"Bearer {two_restaurants[0]['token']}"}
        r1 = requests.post(f"{API}/orders", headers=h1, json={
            "items": [{"vegetable_id": v_a["id"], "qty": 2.0},
                      {"vegetable_id": v_b["id"], "qty": 3.0}],
            "notes": "r1", "delivery_date": target_date,
        }, timeout=15)
        assert r1.status_code == 200, r1.text
        o1 = r1.json()

        # Rest2 orders v_a=1.5 (overlap), v_c=4 for target_date
        h2 = {"Authorization": f"Bearer {two_restaurants[1]['token']}"}
        r2 = requests.post(f"{API}/orders", headers=h2, json={
            "items": [{"vegetable_id": v_a["id"], "qty": 1.5},
                      {"vegetable_id": v_c["id"], "qty": 4.0}],
            "notes": "r2", "delivery_date": target_date,
        }, timeout=15)
        assert r2.status_code == 200, r2.text
        o2 = r2.json()

        # Call purchase-list for target_date
        pl = requests.get(f"{API}/admin/purchase-list", headers=admin_h,
                          params={"delivery_date": target_date}, timeout=10)
        assert pl.status_code == 200, pl.text
        data = pl.json()
        assert data["date"] == target_date
        assert data["order_count"] >= 2
        assert data["restaurant_count"] >= 2

        by_id = {it["vegetable_id"]: it for it in data["items"]}
        assert v_a["id"] in by_id and v_b["id"] in by_id and v_c["id"] in by_id
        # v_a aggregated 2.0 + 1.5 = 3.5 across 2 restaurants
        assert abs(by_id[v_a["id"]]["total_qty"] - 3.5) < 0.01
        assert by_id[v_a["id"]]["restaurants"] == 2
        # v_b only rest1
        assert abs(by_id[v_b["id"]]["total_qty"] - 3.0) < 0.01
        assert by_id[v_b["id"]]["restaurants"] == 1
        # v_c only rest2
        assert abs(by_id[v_c["id"]]["total_qty"] - 4.0) < 0.01
        assert by_id[v_c["id"]]["restaurants"] == 1

        # est_amount roughly equals qty*rate
        for v in (v_a, v_b, v_c):
            expected_amt = round(by_id[v["id"]]["total_qty"] * float(v["rate"]), 2)
            assert abs(by_id[v["id"]]["est_amount"] - expected_amt) < 0.5

        # total_amount equals sum of est_amount
        assert abs(data["total_amount"] - round(sum(it["est_amount"] for it in data["items"]), 2)) < 0.5

        # save for next tests
        pytest.shared = {
            "order_ids": [o1["id"], o2["id"]],
            "target_date": target_date,
        }

    def test_purchase_list_excludes_delivered(self, admin_h):
        info = pytest.shared
        # mark first order delivered
        oid = info["order_ids"][0]
        r = requests.put(f"{API}/orders/{oid}/status", headers=admin_h,
                        params={"status": "delivered"}, timeout=10)
        assert r.status_code == 200
        pl = requests.get(f"{API}/admin/purchase-list", headers=admin_h,
                          params={"delivery_date": info["target_date"]}, timeout=10)
        assert pl.status_code == 200
        # restaurant_count drops to 1
        assert pl.json()["order_count"] == 1

    def test_purchase_list_default_tomorrow(self, admin_h):
        # No param -> defaults to tomorrow
        r = requests.get(f"{API}/admin/purchase-list", headers=admin_h, timeout=10)
        assert r.status_code == 200
        assert r.json()["date"] == tomorrow()

    def test_purchase_list_requires_admin(self, two_restaurants):
        h = {"Authorization": f"Bearer {two_restaurants[0]['token']}"}
        r = requests.get(f"{API}/admin/purchase-list", headers=h, timeout=10)
        assert r.status_code == 403


class TestDeleteOrder:
    def test_admin_delete_order(self, admin_h):
        info = pytest.shared
        oid = info["order_ids"][1]
        # delete
        r = requests.delete(f"{API}/orders/{oid}", headers=admin_h, timeout=10)
        assert r.status_code == 200
        # GET should now 404
        r2 = requests.get(f"{API}/orders/{oid}", headers=admin_h, timeout=10)
        assert r2.status_code == 404

    def test_delete_order_not_found(self, admin_h):
        fake_id = "507f1f77bcf86cd799439011"  # valid ObjectId format
        r = requests.delete(f"{API}/orders/{fake_id}", headers=admin_h, timeout=10)
        assert r.status_code == 404

    def test_restaurant_cannot_delete_order(self, two_restaurants):
        h = {"Authorization": f"Bearer {two_restaurants[0]['token']}"}
        # Create an order to attempt delete
        # Use any order id - even non-existent - role check is first
        r = requests.delete(f"{API}/orders/507f1f77bcf86cd799439099", headers=h, timeout=10)
        assert r.status_code == 403


class TestRestaurantUpdate:
    def test_update_name_phone_address(self, admin_h, two_restaurants):
        rid = two_restaurants[0]["id"]
        new_name = f"TEST_PL_Rest1_RENAMED_{UNIQUE}"
        r = requests.put(f"{API}/restaurants/{rid}", headers=admin_h, json={
            "name": new_name,
            "phone": "9111111111",
            "address": "New Address 123",
        }, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == new_name
        assert data["phone"] == "9111111111"
        assert data["address"] == "New Address 123"

        # verify via list
        rl = requests.get(f"{API}/restaurants", headers=admin_h, timeout=10)
        assert rl.status_code == 200
        names = [u["name"] for u in rl.json()]
        assert new_name in names

    def test_update_password(self, admin_h, two_restaurants):
        rid = two_restaurants[1]["id"]
        new_password = "NewPass@9999"
        r = requests.put(f"{API}/restaurants/{rid}", headers=admin_h,
                         json={"password": new_password}, timeout=10)
        assert r.status_code == 200
        # verify can login with new password
        lr = requests.post(f"{API}/auth/login",
                           json={"email": two_restaurants[1]["email"], "password": new_password}, timeout=10)
        assert lr.status_code == 200
        # old password no longer valid
        lr2 = requests.post(f"{API}/auth/login",
                            json={"email": two_restaurants[1]["email"], "password": REST_PASSWORD}, timeout=10)
        assert lr2.status_code == 401
