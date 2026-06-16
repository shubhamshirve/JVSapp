import { useEffect, useState } from "react";
import { api, formatApiError, inr } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Card, EmptyState } from "@/components/Shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShoppingBag,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  CheckCircle,
  Circle,
  Printer,
} from "lucide-react";

const TABS = ["Suppliers", "Bills"];

export default function AdminPurchases() {
  const [tab, setTab] = useState("Suppliers");

  // ── Suppliers state ──
  const [suppliers, setSuppliers] = useState([]);
  const [supDialog, setSupDialog] = useState(null); // null | "add" | supplier-obj
  const [supForm, setSupForm] = useState({ name: "", phone: "", address: "", notes: "" });

  // ── Bills state ──
  const [bills, setBills] = useState([]);
  const [billDialog, setBillDialog] = useState(null); // null | "add"
  const [billForm, setBillForm] = useState({
    supplier_id: "",
    bill_no: "",
    bill_date: "",
    items: [{ name: "", qty: 1, unit: "kg", rate: "" }],
    notes: "",
  });
  const [filterSup, setFilterSup] = useState("");
  const [expandedBill, setExpandedBill] = useState(null);

  // ── Pay-bill state ──
  const [payDialog, setPayDialog] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  // ── Loaders ──
  const loadSuppliers = () => api.get("/suppliers").then((r) => setSuppliers(r.data));
  const loadBills = () => {
    const q = filterSup ? `?supplier_id=${filterSup}` : "";
    api.get(`/purchase-bills${q}`).then((r) => setBills(r.data));
  };

  useEffect(() => { loadSuppliers(); }, []);
  useEffect(() => { if (tab === "Bills") loadBills(); }, [tab, filterSup]);

  // ── Supplier CRUD ──
  const openAddSup = () => {
    setSupForm({ name: "", phone: "", address: "", notes: "" });
    setSupDialog("add");
  };
  const openEditSup = (s) => {
    setSupForm({ name: s.name, phone: s.phone || "", address: s.address || "", notes: s.notes || "" });
    setSupDialog(s);
  };
  const saveSup = async () => {
    if (!supForm.name.trim()) return toast.error("Supplier name is required");
    try {
      if (supDialog === "add") {
        await api.post("/suppliers", supForm);
        toast.success("Supplier added");
      } else {
        await api.put(`/suppliers/${supDialog.id}`, supForm);
        toast.success("Supplier updated");
      }
      setSupDialog(null);
      loadSuppliers();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };
  const deleteSup = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? All related bills will be removed.`)) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.success("Supplier deleted");
      loadSuppliers();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  // ── Bill CRUD ──
  const openAddBill = () => {
    setBillForm({
      supplier_id: suppliers[0]?.id || "",
      bill_no: "",
      bill_date: new Date().toISOString().split("T")[0],
      items: [{ name: "", qty: 1, unit: "kg", rate: "" }],
      notes: "",
    });
    setBillDialog("add");
  };
  const addItem = () =>
    setBillForm((f) => ({ ...f, items: [...f.items, { name: "", qty: 1, unit: "kg", rate: "" }] }));
  const removeItem = (idx) =>
    setBillForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const setItemField = (idx, key, val) =>
    setBillForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [key]: val } : it)) }));
  const billTotal = billForm.items.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0
  );
  const saveBill = async () => {
    if (!billForm.supplier_id) return toast.error("Select a supplier");
    if (!billForm.bill_date) return toast.error("Enter bill date");
    if (billForm.items.some((it) => !it.name.trim())) return toast.error("Fill all item names");
    try {
      await api.post("/purchase-bills", {
        ...billForm,
        items: billForm.items.map((it) => ({ ...it, qty: Number(it.qty), rate: Number(it.rate) })),
      });
      toast.success("Bill saved");
      setBillDialog(null);
      loadBills();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };
  const deleteBill = async (b) => {
    if (!window.confirm("Delete this purchase bill?")) return;
    try {
      await api.delete(`/purchase-bills/${b.id}`);
      toast.success("Bill deleted");
      loadBills();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };
  const togglePaid = async (b) => {
    try {
      await api.put(`/purchase-bills/${b.id}`, { paid: !b.paid });
      toast.success(b.paid ? "Marked unpaid" : "Marked paid");
      loadBills();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  // ── Supplier payment ──
  const recordPay = async () => {
    if (!payAmount || Number(payAmount) <= 0) return toast.error("Enter a valid amount");
    try {
      await api.post("/supplier-payments", {
        supplier_id: payDialog.supplier_id,
        bill_id: payDialog.id,
        amount: Number(payAmount),
        note: payNote,
        payment_date: new Date().toISOString().split("T")[0],
      });
      toast.success("Payment recorded");
      setPayDialog(null);
      setPayAmount("");
      setPayNote("");
      loadBills();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const totalBilled = bills.reduce((s, b) => s + b.total, 0);
  const totalUnpaid = bills.filter((b) => !b.paid).reduce((s, b) => s + b.total, 0);

  return (
    <div>
      {/* Print header — hidden on screen, visible on print */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Jivdani Vegetable Suppliers</h1>
        <p className="text-sm text-gray-500">
          {tab === "Suppliers" ? "Suppliers List" : "Purchase Bills"} — printed {new Date().toLocaleDateString("en-IN")}
        </p>
        <hr className="mt-2 border-gray-400" />
      </div>

      <PageHeader
        title="Purchases"
        subtitle="Manage vegetable suppliers, purchase bills & payments."
        action={
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="no-print flex items-center gap-2 rounded-xl border border-primary text-primary px-4 py-3 font-semibold hover:bg-primary/10 transition-all"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button
              onClick={() => (tab === "Suppliers" ? openAddSup() : openAddBill())}
              className="no-print flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold hover:bg-[#143a2e] transition-all"
            >
              <Plus className="h-4 w-4" /> Add {tab === "Suppliers" ? "Supplier" : "Bill"}
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 no-print">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              t === tab
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-[#dbe2dc]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ─── Suppliers Tab ─── */}
      {tab === "Suppliers" && (
        <div>
          {suppliers.length === 0 ? (
            <Card>
              <EmptyState
                icon={ShoppingBag}
                title="No suppliers yet"
                subtitle="Add vegetable suppliers to track purchase bills."
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-border">
                <span className="label-cap col-span-4">Name</span>
                <span className="label-cap col-span-2">Phone</span>
                <span className="label-cap col-span-4">Address</span>
                <span className="label-cap col-span-2">Notes</span>
              </div>
              <div className="divide-y divide-border">
                {suppliers.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-2 sm:grid-cols-12 gap-2 px-5 py-4 items-center"
                  >
                    <div className="col-span-2 sm:col-span-4">
                      <p className="font-semibold">{s.name}</p>
                    </div>
                    <div className="sm:col-span-2 text-sm text-muted-foreground">
                      {s.phone || "—"}
                    </div>
                    <div className="sm:col-span-4 text-sm text-muted-foreground truncate">
                      {s.address || "—"}
                    </div>
                    <div className="sm:col-span-1 text-sm text-muted-foreground truncate">
                      {s.notes || "—"}
                    </div>
                    <div className="col-span-2 sm:col-span-1 no-print flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditSup(s)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteSup(s)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── Bills Tab ─── */}
      {tab === "Bills" && (
        <div>
          <div className="flex flex-wrap items-start gap-4 mb-5">
            <div className="flex gap-4">
              <Card className="p-4 min-w-[150px]">
                <p className="label-cap">Total Billed</p>
                <p className="font-heading text-2xl font-extrabold text-primary mt-1">{inr(totalBilled)}</p>
              </Card>
              <Card className="p-4 min-w-[150px]">
                <p className="label-cap">Outstanding</p>
                <p className="font-heading text-2xl font-extrabold text-[#9c531f] mt-1">{inr(totalUnpaid)}</p>
              </Card>
            </div>
            <div className="no-print">
              <label className="label-cap block mb-1.5">Filter by Supplier</label>
              <select
                value={filterSup}
                onChange={(e) => setFilterSup(e.target.value)}
                className="rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none min-w-[180px]"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {bills.length === 0 ? (
            <Card>
              <EmptyState
                icon={ShoppingBag}
                title="No bills"
                subtitle="Add purchase bills to track supplier costs."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {bills.map((b) => (
                <Card key={b.id} className="overflow-hidden">
                  <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => togglePaid(b)}
                        title={b.paid ? "Mark Unpaid" : "Mark Paid"}
                        className="no-print shrink-0"
                      >
                        {b.paid ? (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{b.supplier_name}</p>
                          {b.bill_no && (
                            <span className="text-xs bg-secondary rounded-full px-2 py-0.5">
                              #{b.bill_no}
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              b.paid
                                ? "bg-primary/10 text-primary"
                                : "bg-[#D27D46]/15 text-[#9c531f]"
                            }`}
                          >
                            {b.paid ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {b.bill_date} &middot; {b.items?.length || 0} items
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="label-cap">Total</p>
                        <p className="font-heading font-bold text-lg text-primary">{inr(b.total)}</p>
                      </div>
                      <button
                        onClick={() => setPayDialog(b)}
                        className="no-print rounded-lg border border-primary text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/10 transition-all"
                      >
                        Record Pay
                      </button>
                      <button
                        onClick={() =>
                          setExpandedBill(expandedBill === b.id ? null : b.id)
                        }
                        className="p-1.5 rounded-lg hover:bg-secondary"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            expandedBill === b.id ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => deleteBill(b)}
                        className="no-print p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {(expandedBill === b.id) && (
                    <div className="px-5 pb-4 border-t border-border">
                      <div className="mt-3 bg-secondary/40 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
                          <span className="col-span-5">Item</span>
                          <span className="col-span-2 text-right">Qty</span>
                          <span className="col-span-2 text-right">Rate</span>
                          <span className="col-span-3 text-right">Amount</span>
                        </div>
                        {b.items?.map((it, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-12 px-4 py-2 text-sm border-b border-border last:border-0"
                          >
                            <span className="col-span-5">{it.name}</span>
                            <span className="col-span-2 text-right">
                              {it.qty} {it.unit}
                            </span>
                            <span className="col-span-2 text-right">{inr(it.rate)}</span>
                            <span className="col-span-3 text-right font-medium">
                              {inr(it.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {b.notes && (
                        <p className="text-sm text-muted-foreground mt-2">Note: {b.notes}</p>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Supplier Dialog ── */}
      <Dialog open={!!supDialog} onOpenChange={(v) => !v && setSupDialog(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {supDialog === "add" ? "Add Supplier" : "Edit Supplier"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            {[
              ["Name *", "name", "text"],
              ["Phone", "phone", "tel"],
              ["Address", "address", "text"],
              ["Notes", "notes", "text"],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label className="label-cap">{label}</label>
                <input
                  type={type}
                  value={supForm[key]}
                  onChange={(e) => setSupForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
            ))}
            <button
              onClick={saveSup}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all"
            >
              {supDialog === "add" ? "Add Supplier" : "Save Changes"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bill Dialog ── */}
      <Dialog open={!!billDialog} onOpenChange={(v) => !v && setBillDialog(null)}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Add Purchase Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-cap">Supplier *</label>
                <select
                  value={billForm.supplier_id}
                  onChange={(e) => setBillForm((f) => ({ ...f, supplier_id: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none"
                >
                  <option value="">Select…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-cap">Bill No</label>
                <input
                  value={billForm.bill_no}
                  onChange={(e) => setBillForm((f) => ({ ...f, bill_no: e.target.value }))}
                  placeholder="Optional"
                  className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="label-cap">Bill Date *</label>
              <input
                type="date"
                value={billForm.bill_date}
                onChange={(e) => setBillForm((f) => ({ ...f, bill_date: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-cap">Items</label>
                <button
                  onClick={addItem}
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Row
                </button>
              </div>
              <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground px-1 mb-1">
                <span className="col-span-4">Name</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-center">Unit</span>
                <span className="col-span-3 text-center">Rate ₹</span>
                <span className="col-span-1"></span>
              </div>
              <div className="space-y-1.5">
                {billForm.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      value={it.name}
                      onChange={(e) => setItemField(idx, "name", e.target.value)}
                      placeholder="Item name"
                      className="col-span-4 rounded-lg border border-input bg-white px-2 py-1.5 text-sm outline-none"
                    />
                    <input
                      type="number"
                      value={it.qty}
                      onChange={(e) => setItemField(idx, "qty", e.target.value)}
                      className="col-span-2 rounded-lg border border-input bg-white px-2 py-1.5 text-sm outline-none text-center"
                    />
                    <select
                      value={it.unit}
                      onChange={(e) => setItemField(idx, "unit", e.target.value)}
                      className="col-span-2 rounded-lg border border-input bg-white px-1 py-1.5 text-sm outline-none"
                    >
                      <option>kg</option>
                      <option>g</option>
                      <option>piece</option>
                      <option>dozen</option>
                      <option>bundle</option>
                    </select>
                    <input
                      type="number"
                      value={it.rate}
                      onChange={(e) => setItemField(idx, "rate", e.target.value)}
                      placeholder="0"
                      className="col-span-3 rounded-lg border border-input bg-white px-2 py-1.5 text-sm outline-none"
                    />
                    <button
                      onClick={() => removeItem(idx)}
                      className="col-span-1 flex justify-center p-1 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-medium text-sm">Total</span>
              <span className="font-heading font-bold text-lg text-primary">{inr(billTotal)}</span>
            </div>

            <div>
              <label className="label-cap">Notes</label>
              <input
                value={billForm.notes}
                onChange={(e) => setBillForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none"
              />
            </div>

            <button
              onClick={saveBill}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all"
            >
              Save Bill
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Pay Dialog ── */}
      <Dialog open={!!payDialog} onOpenChange={(v) => !v && setPayDialog(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Record Supplier Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            {payDialog?.supplier_name} &middot; Bill total {inr(payDialog?.total)}
          </p>
          <div className="space-y-3 mt-1">
            <div>
              <label className="label-cap">Amount (₹)</label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="label-cap">Note (optional)</label>
              <input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Cash / NEFT / Cheque"
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={recordPay}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all"
            >
              Record Payment
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
