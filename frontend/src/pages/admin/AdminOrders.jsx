import { useEffect, useState } from "react";
import { api, formatApiError, inr } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/Shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollText, Minus, Plus, Check, Truck, Search, Trash2, Printer } from "lucide-react";

const FILTERS = ["all", "pending", "confirmed", "delivered"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // order being confirmed
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    const q = filter === "all" ? "" : `?status=${filter}`;
    api.get(`/orders${q}`).then((r) => setOrders(r.data));
  };
  useEffect(load, [filter]);

  const openConfirm = (o) => {
    setEditing(o);
    setItems(o.items.map((i) => ({ ...i })));
  };

  const setItem = (idx, key, val) => {
    setItems((it) => it.map((x, i) => (i === idx ? { ...x, [key]: val } : x)));
  };

  const editTotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);

  const save = async (status) => {
    setSaving(true);
    try {
      await api.put(`/orders/${editing.id}/confirm`, {
        items: items.map((i) => ({
          vegetable_id: i.vegetable_id,
          name: i.name,
          unit: i.unit,
          qty: Number(i.qty),
          rate: Number(i.rate),
        })),
        status,
      });
      toast.success(`Order ${status}`);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const markStatus = async (o, status) => {
    try {
      await api.put(`/orders/${o.id}/status?status=${status}`);
      toast.success(`Marked ${status}`);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const delOrder = async (o) => {
    if (!window.confirm(`Delete this order from ${o.restaurant_name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/orders/${o.id}`);
      toast.success("Order deleted");
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const shown = orders.filter((o) =>
    o.restaurant_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">Jivdani Vegetable Suppliers</h1>
        <p className="text-sm text-gray-500">
          Orders List &mdash; printed {new Date().toLocaleDateString("en-IN")}
          {filter !== "all" ? ` · Status: ${filter}` : ""}
        </p>
        <hr className="mt-2 border-gray-400" />
      </div>

      <PageHeader
        title="Orders"
        subtitle="Confirm quantities & rates, then mark delivered."
        action={
          <button
            onClick={() => window.print()}
            className="no-print flex items-center gap-2 rounded-xl border border-primary text-primary px-4 py-3 font-semibold hover:bg-primary/10 transition-all"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        }
      />

      <div className="no-print flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            data-testid={`order-filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-all ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-[#dbe2dc]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="no-print relative mb-5 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          data-testid="order-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by restaurant…"
          className="w-full rounded-xl border border-input bg-white pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={ScrollText} title="No orders found" subtitle="Orders placed by restaurants will appear here." />
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => (
            <Card key={o.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="font-heading font-bold">{o.restaurant_name}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    Ordered {o.order_date} · <Truck className="h-3.5 w-3.5" /> Deliver {o.delivery_date} · {o.items.length} items
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="label-cap">{o.status === "pending" ? "Estimated" : "Total"}</p>
                    <p className="font-heading text-lg font-bold text-primary">{inr(o.total)}</p>
                  </div>
                  {o.status === "pending" && (
                    <button
                      data-testid={`confirm-order-${o.id}`}
                      onClick={() => openConfirm(o)}
                      className="no-print rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-[#143a2e] transition-all"
                    >
                      Review & Confirm
                    </button>
                  )}
                  {o.status === "confirmed" && (
                    <button
                      data-testid={`deliver-order-${o.id}`}
                      onClick={() => markStatus(o, "delivered")}
                      className="no-print rounded-xl border border-primary text-primary px-4 py-2.5 text-sm font-semibold hover:bg-primary/10 transition-all"
                    >
                      Mark Delivered
                    </button>
                  )}
                  <button
                    data-testid={`delete-order-${o.id}`}
                    onClick={() => delOrder(o)}
                    title="Delete order"
                    className="no-print p-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {o.items.map((i) => (
                  <span key={i.vegetable_id}>
                    {i.name} <b className="text-foreground">{i.qty}{i.unit}</b>
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Confirm Order · {editing?.restaurant_name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Adjust final quantity (kg) and today's rate. The restaurant's bill updates accordingly.
          </p>
          <div className="space-y-2.5 mt-2">
            {items.map((i, idx) => (
              <div key={i.vegetable_id} className="flex items-center gap-2 bg-secondary/40 rounded-xl p-2.5">
                <span className="flex-1 font-medium text-sm truncate">{i.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setItem(idx, "qty", Math.max(0, Number(i.qty) - 0.5))}
                    className="h-7 w-7 rounded-full bg-white border border-border flex items-center justify-center"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    data-testid={`confirm-qty-${idx}`}
                    value={i.qty}
                    onChange={(e) => setItem(idx, "qty", e.target.value)}
                    className="w-12 text-center text-sm font-semibold bg-transparent outline-none"
                  />
                  <button
                    onClick={() => setItem(idx, "qty", Number(i.qty) + 0.5)}
                    className="h-7 w-7 rounded-full bg-white border border-border flex items-center justify-center"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1 w-24">
                  <span className="text-xs text-muted-foreground">₹</span>
                  <input
                    data-testid={`confirm-rate-${idx}`}
                    value={i.rate}
                    onChange={(e) => setItem(idx, "rate", e.target.value)}
                    className="w-full text-sm bg-white border border-border rounded-lg px-2 py-1 outline-none"
                  />
                </div>
                <span className="w-16 text-right text-sm font-semibold">
                  {inr((Number(i.qty) || 0) * (Number(i.rate) || 0))}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
            <span className="font-heading font-bold">Final Bill</span>
            <span data-testid="confirm-total" className="font-heading text-xl font-extrabold text-primary">
              {inr(editTotal)}
            </span>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              data-testid="save-confirm-button"
              onClick={() => save("confirmed")}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> Confirm Order
            </button>
            <button
              onClick={() => save("delivered")}
              disabled={saving}
              className="rounded-xl border border-border px-4 py-3 font-semibold hover:bg-secondary transition-all"
            >
              Confirm & Deliver
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
