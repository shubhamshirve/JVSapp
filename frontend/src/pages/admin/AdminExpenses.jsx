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
import { Receipt, Plus, Pencil, Trash2, Printer } from "lucide-react";

const CATEGORIES = [
  "Transport",
  "Labor",
  "Packaging",
  "Fuel",
  "Maintenance",
  "Utilities",
  "Misc",
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterCat, setFilterCat] = useState("all");
  const [dialog, setDialog] = useState(null); // null | "add" | expense-obj
  const [form, setForm] = useState({
    category: "Misc",
    amount: "",
    expense_date: "",
    bill_ref: "",
    notes: "",
  });

  const load = () => api.get(`/expenses?month=${month}`).then((r) => setExpenses(r.data));
  useEffect(load, [month]);

  const openAdd = () => {
    setForm({
      category: "Misc",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      bill_ref: "",
      notes: "",
    });
    setDialog("add");
  };

  const openEdit = (e) => {
    setForm({
      category: e.category,
      amount: e.amount,
      expense_date: e.expense_date,
      bill_ref: e.bill_ref || "",
      notes: e.notes || "",
    });
    setDialog(e);
  };

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return toast.error("Enter a valid amount");
    if (!form.expense_date) return toast.error("Select a date");
    try {
      if (dialog === "add") {
        await api.post("/expenses", { ...form, amount: Number(form.amount) });
        toast.success("Expense added");
      } else {
        await api.put(`/expenses/${dialog.id}`, { ...form, amount: Number(form.amount) });
        toast.success("Expense updated");
      }
      setDialog(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const del = async (e) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await api.delete(`/expenses/${e.id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const shown = expenses.filter(
    (e) => filterCat === "all" || e.category === filterCat
  );
  const total = shown.reduce((s, e) => s + Number(e.amount), 0);

  const monthLabel = () => {
    const [y, m] = month.split("-");
    return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
  };

  return (
    <div>
      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Jivdani Vegetable Suppliers</h1>
        <p className="text-sm text-gray-500">
          Expenses — {monthLabel()} — printed {new Date().toLocaleDateString("en-IN")}
        </p>
        <hr className="mt-2 border-gray-400" />
      </div>

      <PageHeader
        title="Expenses"
        subtitle="Track miscellaneous and operational expenses."
        action={
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="no-print flex items-center gap-2 rounded-xl border border-primary text-primary px-4 py-3 font-semibold hover:bg-primary/10 transition-all"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button
              onClick={openAdd}
              className="no-print flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold hover:bg-[#143a2e] transition-all"
            >
              <Plus className="h-4 w-4" /> Add Expense
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-center no-print">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCat("all")}
            className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
              filterCat === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-[#dbe2dc]"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                filterCat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-[#dbe2dc]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Summary card */}
      <Card className="p-5 mb-5 flex items-center justify-between">
        <div>
          <p className="label-cap">Total Expenses — {monthLabel()}</p>
          <p className="font-heading text-3xl font-extrabold text-[#9c531f] mt-1">
            {inr(total)}
          </p>
        </div>
        <Receipt className="h-8 w-8 text-[#9c531f]/50" />
      </Card>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="No expenses"
            subtitle="Add operational expenses to track costs."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-border">
            <span className="label-cap col-span-2">Date</span>
            <span className="label-cap col-span-2">Category</span>
            <span className="label-cap col-span-2 text-right">Amount</span>
            <span className="label-cap col-span-3">Bill Ref</span>
            <span className="label-cap col-span-2">Notes</span>
            <span className="label-cap col-span-1 text-right">Actions</span>
          </div>
          <div className="divide-y divide-border">
            {shown.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-2 sm:grid-cols-12 gap-2 px-5 py-3.5 items-center"
              >
                <span className="sm:col-span-2 text-sm">{e.expense_date}</span>
                <span className="sm:col-span-2">
                  <span className="text-xs bg-secondary rounded-full px-2 py-1 font-medium">
                    {e.category}
                  </span>
                </span>
                <span className="sm:col-span-2 sm:text-right font-semibold text-primary">
                  {inr(e.amount)}
                </span>
                <span className="sm:col-span-3 text-sm text-muted-foreground truncate">
                  {e.bill_ref || "—"}
                </span>
                <span className="sm:col-span-2 text-sm text-muted-foreground truncate">
                  {e.notes || "—"}
                </span>
                <div className="col-span-2 sm:col-span-1 no-print flex items-center justify-end gap-1">
                  <button
                    onClick={() => openEdit(e)}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => del(e)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-border flex justify-end">
            <span className="font-heading font-bold text-lg text-primary">
              Total: {inr(total)}
            </span>
          </div>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {dialog === "add" ? "Add Expense" : "Edit Expense"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div>
              <label className="label-cap">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-cap">Amount (₹) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="label-cap">Date *</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="label-cap">Bill Reference</label>
              <input
                value={form.bill_ref}
                onChange={(e) => setForm((f) => ({ ...f, bill_ref: e.target.value }))}
                placeholder="Bill no. / reference"
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="label-cap">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Additional details"
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <button
              onClick={save}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all"
            >
              {dialog === "add" ? "Add Expense" : "Save Changes"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
