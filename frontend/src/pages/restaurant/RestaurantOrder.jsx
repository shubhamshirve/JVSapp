import { useEffect, useMemo, useState } from "react";
import { api, formatApiError, inr } from "@/lib/api";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Search, Minus, Plus, ShoppingBasket, Loader2, CheckCircle2, Truck, RotateCcw } from "lucide-react";
import { Card } from "@/components/Shared";

export default function RestaurantOrder() {
  const [vegetables, setVegetables] = useState([]);
  const [qty, setQty] = useState({}); // id -> kg
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    api.get("/vegetables").then((r) => setVegetables(r.data));
    api.get("/orders").then((r) => setLastOrder(r.data[0] || null));
  }, []);

  const repeatLast = () => {
    if (!lastOrder) return;
    const activeIds = new Set(vegetables.map((v) => v.id));
    const next = {};
    let skipped = 0;
    lastOrder.items.forEach((it) => {
      if (activeIds.has(it.vegetable_id)) next[it.vegetable_id] = it.qty;
      else skipped += 1;
    });
    const count = Object.keys(next).length;
    if (count === 0) {
      toast.error("None of the items from your last order are available today.");
      return;
    }
    setQty(next);
    toast.success(
      `Loaded ${count} item${count > 1 ? "s" : ""} from your last order${skipped ? ` · ${skipped} no longer available` : ""}.`
    );
  };

  const setVal = (id, v) => {
    const val = Math.max(0, Math.round(v * 4) / 4); // 0.25 steps
    setQty((q) => ({ ...q, [id]: val }));
  };

  const filtered = useMemo(
    () => vegetables.filter((v) => v.name.toLowerCase().includes(search.toLowerCase())),
    [vegetables, search]
  );

  const lineItems = vegetables
    .filter((v) => (qty[v.id] || 0) > 0)
    .map((v) => ({ ...v, q: qty[v.id], amount: qty[v.id] * v.rate }));
  const total = lineItems.reduce((s, i) => s + i.amount, 0);
  const totalItems = lineItems.length;

  const submit = async () => {
    if (totalItems === 0) {
      toast.error("Add at least one vegetable to your order.");
      return;
    }
    setSubmitting(true);
    try {
      const items = lineItems.map((i) => ({ vegetable_id: i.id, qty: i.q }));
      const { data } = await api.post("/orders", { items, notes });
      setPlaced(data);
      setLastOrder(data);
      setQty({});
      setNotes("");
      toast.success("Order placed successfully!");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  if (placed) {
    return (
      <div className="max-w-xl mx-auto animate-fadeup">
        <Card className="p-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Order placed!</h1>
          <p className="text-muted-foreground mt-1">
            Estimated bill <span className="font-semibold text-foreground">{inr(placed.total)}</span> ·{" "}
            {placed.items.length} items
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-3">
            <Truck className="h-4 w-4" /> Delivery: {placed.delivery_date}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Your order is <b>pending admin confirmation</b>. Final bill may vary slightly with the
            day's market rate.
          </p>
          <div className="mt-6 text-left bg-secondary/50 rounded-xl p-4 divide-y divide-border">
            {placed.items.map((i) => (
              <div key={i.vegetable_id} className="flex justify-between py-2 text-sm">
                <span>
                  {i.name} <span className="text-muted-foreground">× {i.qty} {i.unit}</span>
                </span>
                <span className="font-medium">{inr(i.amount)}</span>
              </div>
            ))}
          </div>
          <button
            data-testid="place-another-order"
            onClick={() => setPlaced(null)}
            className="mt-6 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold hover:bg-[#143a2e] transition-all"
          >
            Place another order
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Today's Order</h1>
          <p className="text-muted-foreground mt-1">
            Tap + / − to set quantity in kg. Bill updates live with today's market rates.
          </p>
        </div>
        {lastOrder && (
          <button
            data-testid="repeat-last-order-button"
            onClick={repeatLast}
            className="flex items-center gap-2 rounded-xl border border-primary text-primary px-4 py-2.5 text-sm font-semibold hover:bg-primary/10 hover:-translate-y-[1px] transition-all"
          >
            <RotateCcw className="h-4 w-4" /> Repeat last order
          </button>
        )}
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          data-testid="veg-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vegetables…"
          className="w-full rounded-xl border border-input bg-white pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((v, idx) => {
          const q = qty[v.id] || 0;
          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.3) }}
              data-testid={`veg-row-${v.id}`}
              className={`flex items-center justify-between gap-3 bg-card border rounded-2xl p-4 transition-all ${
                q > 0 ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{v.name}</p>
                <p className="text-sm text-muted-foreground">
                  {inr(v.rate)} / {v.unit}
                  {q > 0 && (
                    <span className="text-primary font-semibold"> · {inr(q * v.rate)}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  data-testid={`veg-minus-${v.id}`}
                  onClick={() => setVal(v.id, q - 0.5)}
                  className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-[#dbe2dc] transition-all disabled:opacity-40"
                  disabled={q <= 0}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  data-testid={`veg-qty-${v.id}`}
                  value={q}
                  onChange={(e) => setVal(v.id, parseFloat(e.target.value) || 0)}
                  className="w-12 text-center font-semibold bg-transparent outline-none"
                />
                <button
                  data-testid={`veg-plus-${v.id}`}
                  onClick={() => setVal(v.id, q + 0.5)}
                  className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-[#143a2e] transition-all"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {totalItems > 0 && (
        <div className="mt-6 max-w-md">
          <label className="label-cap">Notes (optional)</label>
          <textarea
            data-testid="order-notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any special instructions…"
            className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-20 px-4 sm:px-6 lg:px-10 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="label-cap">Estimated Bill</p>
              <p data-testid="live-total" className="font-heading text-2xl font-extrabold text-primary">
                {inr(total)}
              </p>
            </div>
            <button
              data-testid="submit-order-button"
              onClick={submit}
              disabled={submitting || totalItems === 0}
              className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3.5 font-semibold hover:bg-[#143a2e] hover:-translate-y-[1px] hover:shadow-md transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBasket className="h-5 w-5" />}
              Place Order{totalItems > 0 ? ` · ${totalItems}` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
