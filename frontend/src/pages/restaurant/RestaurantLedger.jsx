import { useEffect, useState } from "react";
import { api, inr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/Shared";
import { Wallet, TrendingUp, ReceiptText } from "lucide-react";

export default function RestaurantLedger() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (user?.id) api.get(`/ledger/${user.id}`).then((r) => setData(r.data));
  }, [user]);

  if (!data) return null;

  const stats = [
    { label: "Total Billed", value: data.billed, icon: TrendingUp, color: "text-primary" },
    { label: "Paid", value: data.paid, icon: ReceiptText, color: "text-[#2f6b40]" },
    { label: "Pending Balance", value: data.pending, icon: Wallet, color: "text-[#9c531f]" },
  ];

  return (
    <div>
      <PageHeader title="My Ledger" subtitle="Your billing summary and payment history." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="label-cap">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`font-heading text-2xl font-extrabold mt-2 ${s.color}`}>{inr(s.value)}</p>
          </Card>
        ))}
      </div>

      <h3 className="font-heading text-lg font-bold mb-3">Payment History</h3>
      <Card className="mb-7">
        {data.payments.length === 0 ? (
          <EmptyState title="No payments recorded yet" />
        ) : (
          <div className="divide-y divide-border">
            {data.payments.map((p) => (
              <div key={p.id} className="flex justify-between items-center px-5 py-3.5">
                <div>
                  <p className="font-medium">{inr(p.amount)}</p>
                  <p className="text-sm text-muted-foreground">{p.note || "Payment received"}</p>
                </div>
                <p className="text-sm text-muted-foreground">{(p.created_at || "").slice(0, 10)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <h3 className="font-heading text-lg font-bold mb-3">Order History</h3>
      <Card>
        {data.orders.length === 0 ? (
          <EmptyState title="No orders yet" />
        ) : (
          <div className="divide-y divide-border">
            {data.orders.map((o) => (
              <div key={o.id} className="flex justify-between items-center px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <StatusBadge status={o.status} />
                  <span className="text-sm text-muted-foreground">{o.order_date}</span>
                </div>
                <p className="font-medium">{inr(o.total)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
