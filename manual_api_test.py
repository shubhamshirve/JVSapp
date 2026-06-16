"""
Manual API test to verify all requested endpoints work correctly
"""
import os
import requests
from datetime import date
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@jivdani.com"
ADMIN_PASSWORD = "Jivdani@2026"

def test_all_endpoints():
    print("=" * 60)
    print("Testing Jivdani Vegetable Suppliers Backend APIs")
    print("=" * 60)
    
    # Login as admin
    print("\n1. Admin Login...")
    r = requests.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }, timeout=10)
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Admin login successful")
    
    # Test Suppliers CRUD
    print("\n2. Testing Suppliers CRUD...")
    
    # POST - Create supplier
    r = requests.post(f"{API}/suppliers", headers=headers, json={
        "name": "Fresh Farms",
        "phone": "9876543210",
        "address": "Mumbai Market"
    }, timeout=10)
    assert r.status_code == 200, f"Create supplier failed: {r.text}"
    supplier = r.json()
    supplier_id = supplier["id"]
    print(f"✅ Created supplier: {supplier['name']} (ID: {supplier_id})")
    
    # GET - List all suppliers
    r = requests.get(f"{API}/suppliers", headers=headers, timeout=10)
    assert r.status_code == 200, f"List suppliers failed: {r.text}"
    suppliers = r.json()
    print(f"✅ Listed {len(suppliers)} suppliers")
    
    # PUT - Update supplier name
    r = requests.put(f"{API}/suppliers/{supplier_id}", headers=headers, json={
        "name": "Fresh Farms Premium"
    }, timeout=10)
    assert r.status_code == 200, f"Update supplier failed: {r.text}"
    print(f"✅ Updated supplier name to: {r.json()['name']}")
    
    # Test Purchase Bills CRUD
    print("\n3. Testing Purchase Bills CRUD...")
    
    # POST - Create bill
    today = date.today().isoformat()
    r = requests.post(f"{API}/purchase-bills", headers=headers, json={
        "supplier_id": supplier_id,
        "bill_no": "TEST-001",
        "bill_date": today,
        "items": [
            {"name": "Tomato", "qty": 10, "unit": "kg", "rate": 30}
        ]
    }, timeout=10)
    assert r.status_code == 200, f"Create bill failed: {r.text}"
    bill = r.json()
    bill_id = bill["id"]
    print(f"✅ Created bill: {bill['bill_no']} (Total: ₹{bill['total']})")
    assert bill["total"] == 300.0, f"Bill total incorrect: expected 300, got {bill['total']}"
    
    # GET - List bills
    r = requests.get(f"{API}/purchase-bills", headers=headers, timeout=10)
    assert r.status_code == 200, f"List bills failed: {r.text}"
    bills = r.json()
    print(f"✅ Listed {len(bills)} bills")
    
    # PUT - Mark bill paid
    r = requests.put(f"{API}/purchase-bills/{bill_id}", headers=headers, json={
        "paid": True
    }, timeout=10)
    assert r.status_code == 200, f"Update bill failed: {r.text}"
    assert r.json()["paid"] is True
    print(f"✅ Marked bill as paid")
    
    # Test Supplier Payments
    print("\n4. Testing Supplier Payments...")
    
    # POST - Create payment
    r = requests.post(f"{API}/supplier-payments", headers=headers, json={
        "supplier_id": supplier_id,
        "bill_id": bill_id,
        "amount": 500,
        "note": "Cash"
    }, timeout=10)
    assert r.status_code == 200, f"Create payment failed: {r.text}"
    payment = r.json()
    payment_id = payment["id"]
    print(f"✅ Created payment: ₹{payment['amount']} ({payment['note']})")
    
    # GET - List payments
    r = requests.get(f"{API}/supplier-payments", headers=headers, timeout=10)
    assert r.status_code == 200, f"List payments failed: {r.text}"
    payments = r.json()
    print(f"✅ Listed {len(payments)} payments")
    
    # Test Expenses CRUD
    print("\n5. Testing Expenses CRUD...")
    
    # POST - Create expense
    r = requests.post(f"{API}/expenses", headers=headers, json={
        "category": "Transport",
        "amount": 250,
        "expense_date": "2025-07-01",
        "bill_ref": "TRP-001",
        "notes": "Fuel for delivery"
    }, timeout=10)
    assert r.status_code == 200, f"Create expense failed: {r.text}"
    expense = r.json()
    expense_id = expense["id"]
    print(f"✅ Created expense: {expense['category']} - ₹{expense['amount']}")
    
    # GET - List expenses with month filter
    r = requests.get(f"{API}/expenses", headers=headers, params={"month": "2025-07"}, timeout=10)
    assert r.status_code == 200, f"List expenses failed: {r.text}"
    expenses = r.json()
    print(f"✅ Listed {len(expenses)} expenses for July 2025")
    
    # PUT - Update amount
    r = requests.put(f"{API}/expenses/{expense_id}", headers=headers, json={
        "amount": 300
    }, timeout=10)
    assert r.status_code == 200, f"Update expense failed: {r.text}"
    assert r.json()["amount"] == 300.0
    print(f"✅ Updated expense amount to ₹300")
    
    # Test Reports
    print("\n6. Testing Reports...")
    
    # GET - Monthly report
    r = requests.get(f"{API}/reports/monthly", headers=headers, params={
        "year": 2025,
        "month": 7
    }, timeout=15)
    assert r.status_code == 200, f"Monthly report failed: {r.text}"
    monthly = r.json()
    print(f"✅ Monthly report (2025-07):")
    print(f"   - Revenue: ₹{monthly['revenue']}")
    print(f"   - Supplier Cost: ₹{monthly['supplier_cost']}")
    print(f"   - Expenses: ₹{monthly['expenses']}")
    print(f"   - Gross Profit: ₹{monthly['gross_profit']}")
    
    # Verify calculation
    expected_profit = monthly['revenue'] - monthly['supplier_cost'] - monthly['expenses']
    assert abs(monthly['gross_profit'] - expected_profit) < 0.01, "Gross profit calculation incorrect"
    
    # GET - Yearly report
    r = requests.get(f"{API}/reports/yearly", headers=headers, params={
        "year": 2025
    }, timeout=20)
    assert r.status_code == 200, f"Yearly report failed: {r.text}"
    yearly = r.json()
    assert len(yearly["months"]) == 12
    print(f"✅ Yearly report (2025): 12 months data retrieved")
    
    # Cleanup
    print("\n7. Cleanup...")
    
    # DELETE - Delete expense
    r = requests.delete(f"{API}/expenses/{expense_id}", headers=headers, timeout=10)
    assert r.status_code == 200, f"Delete expense failed: {r.text}"
    print(f"✅ Deleted expense")
    
    # DELETE - Delete bill (should cascade delete payment)
    r = requests.delete(f"{API}/purchase-bills/{bill_id}", headers=headers, timeout=10)
    assert r.status_code == 200, f"Delete bill failed: {r.text}"
    print(f"✅ Deleted bill")
    
    # Verify payment was cascade deleted
    r = requests.get(f"{API}/supplier-payments", headers=headers, timeout=10)
    payment_ids = [p["id"] for p in r.json()]
    assert payment_id not in payment_ids, "Payment should have been cascade deleted"
    print(f"✅ Verified payment was cascade deleted")
    
    # DELETE - Delete supplier
    r = requests.delete(f"{API}/suppliers/{supplier_id}", headers=headers, timeout=10)
    assert r.status_code == 200, f"Delete supplier failed: {r.text}"
    print(f"✅ Deleted supplier")
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    test_all_endpoints()
