import { useEffect, useState } from "react";
import { api, inr } from "@/lib/api";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/Shared";
import {
  ScrollText,
  Clock,
  IndianRupee,
  Wallet,
  Store,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data));
  }, []);

  if (!stats) return null;

  const cards = [
    { label: "Total Orders", value: stats.total_orders, icon: ScrollText, sub: `${stats.today_orders} today` },
    { label: "Today's Value", value: inr(stats.today_value), icon: TrendingUp, sub: "from today's orders" },
    { label: "Pending Orders", value: stats.pending_orders, icon: Clock, sub: "need confirmation", accent: true },
    { label: "Total Billed", value: inr(stats.total_bill_value), icon: IndianRupee, sub: "confirmed + delivered" },
    { label: "Pending Bills", value: inr(stats.total_pending), icon: Wallet, sub: `${inr(stats.total_paid)} collected`, danger: true },
    { label: "Restaurants", value: stats.restaurants, icon: Store, sub: `${stats.pending_approvals} awaiting approval` },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of orders, billing and pending payments." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-7">
        {cards.map((c) => (
          <Card key={c.label} className="p-5" >
            <div className="flex items-start justify-between">
              <div>
                <p className="label-cap">{c.label}</p>
                <p
                  data-testid={`stat-${c.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                  className={`font-heading text-3xl font-extrabold mt-2 ${
                    c.danger ? "text-[#9c531f]" : c.accent ? "text-[#D27D46]" : "text-foreground"
                  }`}
                >
                  {c.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{c.sub}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                <c.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-heading text-lg font-bold mb-4">Last 7 days · Order value</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1ee" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#5C635A" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#5C635A" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => inr(v)}
                contentStyle={{ borderRadius: 12, border: "1px solid #E2E8E4", fontSize: 13 }}
              />
              <Bar dataKey="value" fill="#1B4D3E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-heading text-lg font-bold mb-3">Recent Orders</h3>
          {stats.recent_orders.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <div className="divide-y divide-border">
              {stats.recent_orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{o.restaurant_name}</p>
                    <p className="text-sm text-muted-foreground">{o.order_date} · {o.items.length} items</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={o.status} />
                    <span className="font-semibold">{inr(o.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
