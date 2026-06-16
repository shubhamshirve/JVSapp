import { useEffect, useState } from "react";
import { api, inr } from "@/lib/api";
import { PageHeader, Card, EmptyState } from "@/components/Shared";
import {
  TrendingUp,
  IndianRupee,
  Wallet,
  ShoppingBag,
  Receipt,
  TrendingDown,
  Printer,
  BarChart2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const YEARS = [2024, 2025, 2026, 2027];

export default function AdminReports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthly, setMonthly] = useState(null);
  const [yearly, setYearly] = useState(null);

  const loadMonthly = (yr, mo) =>
    api.get(`/reports/monthly?year=${yr}&month=${mo}`).then((r) => setMonthly(r.data));
  const loadYearly = (yr) =>
    api.get(`/reports/yearly?year=${yr}`).then((r) => setYearly(r.data));

  useEffect(() => { loadMonthly(year, month); loadYearly(year); }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const cards = monthly
    ? [
        {
          label: "Revenue",
          value: inr(monthly.revenue),
          sub: `${monthly.order_count} orders confirmed/delivered`,
          icon: TrendingUp,
          color: "text-primary",
        },
        {
          label: "Payments Received",
          value: inr(monthly.payments_received),
          sub: "collected from restaurants this month",
          icon: IndianRupee,
          color: "text-[#2f6b40]",
        },
        {
          label: "Pending Receivables",
          value: inr(monthly.pending_receivables),
          sub: "total outstanding across all restaurants",
          icon: Wallet,
          color: "text-[#9c531f]",
        },
        {
          label: "Supplier Cost",
          value: inr(monthly.supplier_cost),
          sub: `${inr(monthly.supplier_outstanding)} still outstanding to suppliers`,
          icon: ShoppingBag,
          color: "text-[#D27D46]",
        },
        {
          label: "Expenses",
          value: inr(monthly.expenses),
          sub: "operational & miscellaneous",
          icon: Receipt,
          color: "text-muted-foreground",
        },
        {
          label: "Gross Profit",
          value: inr(monthly.gross_profit),
          sub: "revenue − supplier cost − expenses",
          icon: monthly.gross_profit >= 0 ? TrendingUp : TrendingDown,
          color: monthly.gross_profit >= 0 ? "text-primary" : "text-destructive",
        },
      ]
    : [];

  return (
    <div>
      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Jivdani Vegetable Suppliers</h1>
        <p className="text-sm text-gray-500">
          Financial Report — {monthLabel} — printed {new Date().toLocaleDateString("en-IN")}
        </p>
        <hr className="mt-2 border-gray-400" />
      </div>

      <PageHeader
        title="Reports"
        subtitle="Month-wise revenue, payments, supplier costs & expenses."
        action={
          <button
            onClick={() => window.print()}
            className="no-print flex items-center gap-2 rounded-xl border border-primary text-primary px-4 py-3 font-semibold hover:bg-primary/10 transition-all"
          >
            <Printer className="h-4 w-4" /> Print Report
          </button>
        }
      />

      {/* Period selector */}
      <div className="no-print flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-muted-foreground font-medium">
          Showing: {monthLabel}
        </span>
      </div>

      {!monthly && (
        <div className="text-center py-10 text-muted-foreground">Loading report…</div>
      )}

      {monthly && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-7">
            {cards.map((c) => (
              <Card key={c.label} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="label-cap">{c.label}</p>
                    <p className={`font-heading text-2xl font-extrabold mt-2 ${c.color}`}>
                      {c.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <c.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Expense breakdown */}
          {Object.keys(monthly.expense_breakdown).length > 0 && (
            <Card className="p-5 mb-6">
              <h3 className="font-heading text-lg font-bold mb-4">
                Expense Breakdown — {monthLabel}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(monthly.expense_breakdown).map(([cat, amt]) => (
                  <div key={cat} className="bg-secondary/40 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">{cat}</p>
                    <p className="font-heading font-bold text-lg mt-0.5">{inr(amt)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Yearly chart */}
          <Card className="p-5 mb-6 no-print">
            <h3 className="font-heading text-lg font-bold mb-4">
              Year {year} &mdash; Monthly Overview
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yearly?.months || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1ee" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#5C635A" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#5C635A" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v) => inr(v)}
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8E4", fontSize: 13 }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#1B4D3E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#D27D46" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gross_profit" name="Gross Profit" fill="#3d7a4e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Monthly table */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="font-heading font-bold">{year} — Month-by-Month</h3>
            </div>
            <div className="grid grid-cols-6 px-5 py-2 border-b border-border bg-secondary/30">
              <span className="label-cap">Month</span>
              <span className="label-cap text-right">Revenue</span>
              <span className="label-cap text-right">Pmts Recv.</span>
              <span className="label-cap text-right">Supplier</span>
              <span className="label-cap text-right">Expenses</span>
              <span className="label-cap text-right">Profit</span>
            </div>
            <div className="divide-y divide-border">
              {yearly?.months.map((m, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-6 px-5 py-3 items-center text-sm ${
                    i + 1 === month ? "bg-primary/5 font-medium" : ""
                  }`}
                >
                  <span className="font-medium">{MONTH_NAMES[i]}</span>
                  <span className="text-right">{inr(m.revenue)}</span>
                  <span className="text-right text-[#2f6b40]">{inr(m.payments_received)}</span>
                  <span className="text-right text-[#D27D46]">{inr(m.supplier_cost)}</span>
                  <span className="text-right text-muted-foreground">{inr(m.expenses)}</span>
                  <span
                    className={`text-right font-semibold ${
                      m.gross_profit >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {inr(m.gross_profit)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {!monthly && !yearly && (
        <Card>
          <EmptyState
            icon={BarChart2}
            title="No data yet"
            subtitle="Start adding orders, expenses and purchase bills to see reports."
          />
        </Card>
      )}
    </div>
  );
}
