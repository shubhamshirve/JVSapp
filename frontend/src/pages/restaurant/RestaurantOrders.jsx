import { useEffect, useState } from "react";
import { api, inr } from "@/lib/api";
import { PageHeader, StatusBadge, Card, EmptyState } from "@/components/Shared";
import { ScrollText, Truck, ChevronDown } from "lucide-react";

export default function RestaurantOrders() {
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get("/orders").then((r) => setOrders(r.data));
  }, []);

  return (
    <div>
      <PageHeader title="My Orders" subtitle="Track your placed orders and their final bills." />
      {orders.length === 0 ? (
        <Card>
          <EmptyState icon={ScrollText} title="No orders yet" subtitle="Place your first order from the Place Order tab." />
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="overflow-hidden">
              <button
                data-testid={`order-card-${o.id}`}
                onClick={() => setOpen(open === o.id ? null : o.id)}
                className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left hover:bg-secondary/40 transition-all"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <StatusBadge status={o.status} />
                    <span className="text-sm text-muted-foreground">Ordered {o.order_date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
                    <Truck className="h-3.5 w-3.5" /> Delivery {o.delivery_date} · {o.items.length} items
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="label-cap">{o.status === "pending" ? "Estimated" : "Total"}</p>
                    <p className="font-heading text-lg font-bold text-primary">{inr(o.total)}</p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${open === o.id ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
              {open === o.id && (
                <div className="px-4 sm:px-5 pb-5 animate-fadeup">
                  <div className="bg-secondary/40 rounded-xl divide-y divide-border">
                    {o.items.map((i) => (
                      <div key={i.vegetable_id} className="flex justify-between px-4 py-2.5 text-sm">
                        <span>
                          {i.name}{" "}
                          <span className="text-muted-foreground">
                            {i.qty} {i.unit} × {inr(i.rate)}
                          </span>
                        </span>
                        <span className="font-medium">{inr(i.amount)}</span>
                      </div>
                    ))}
                  </div>
                  {o.notes && <p className="text-sm text-muted-foreground mt-3">Note: {o.notes}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
