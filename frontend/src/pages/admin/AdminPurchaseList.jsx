import { useEffect, useState } from "react";
import { api, inr } from "@/lib/api";
import { PageHeader, Card, EmptyState } from "@/components/Shared";
import { ClipboardList, Printer, CalendarDays } from "lucide-react";

export default function AdminPurchaseList() {
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);

  const load = (d) => {
    const q = d ? `?delivery_date=${d}` : "";
    api.get(`/admin/purchase-list${q}`).then((r) => {
      setData(r.data);
      setDate((cur) => cur || r.data.date);
    });
  };
  useEffect(() => { load(); }, []);

  const onDateChange = (e) => {
    setDate(e.target.value);
    load(e.target.value);
  };

  if (!data) return null;

  return (
    <div>
      <PageHeader
        title="Purchase List"
        subtitle="Consolidated vegetables to buy for the delivery date — across all restaurants."
        action={
          <button
            data-testid="print-purchase-list"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold hover:bg-[#143a2e] hover:-translate-y-[1px] hover:shadow-md transition-all"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            data-testid="purchase-date-input"
            type="date"
            value={date}
            onChange={onDateChange}
            className="rounded-xl border border-input bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
        <p className="text-sm text-muted-foreground">Delivery date (pending + confirmed orders)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <p className="label-cap">Vegetables to buy</p>
          <p data-testid="purchase-veg-count" className="font-heading text-3xl font-extrabold mt-1">{data.items.length}</p>
        </Card>
        <Card className="p-5">
          <p className="label-cap">Orders / Restaurants</p>
          <p className="font-heading text-3xl font-extrabold mt-1">{data.order_count} / {data.restaurant_count}</p>
        </Card>
        <Card className="p-5">
          <p className="label-cap">Estimated cost</p>
          <p className="font-heading text-3xl font-extrabold mt-1 text-primary">{inr(data.total_amount)}</p>
        </Card>
      </div>

      {data.items.length === 0 ? (
        <Card><EmptyState icon={ClipboardList} title="Nothing to buy" subtitle="No pending or confirmed orders for this delivery date." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 border-b border-border">
            <span className="label-cap col-span-5">Vegetable</span>
            <span className="label-cap col-span-3 text-right">Total Qty</span>
            <span className="label-cap col-span-2 text-right">Rate</span>
            <span className="label-cap col-span-2 text-right">Est. Cost</span>
          </div>
          <div className="divide-y divide-border">
            {data.items.map((it) => (
              <div key={it.vegetable_id} data-testid={`purchase-row-${it.vegetable_id}`} className="grid grid-cols-12 px-5 py-3.5 items-center">
                <div className="col-span-5">
                  <p className="font-semibold">{it.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.restaurants} restaurant{it.restaurants > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="col-span-3 text-right font-heading font-bold text-lg">
                  {it.total_qty} <span className="text-sm font-normal text-muted-foreground">{it.unit}</span>
                </span>
                <span className="col-span-2 text-right text-muted-foreground">{inr(it.rate)}</span>
                <span className="col-span-2 text-right font-semibold">{inr(it.est_amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
