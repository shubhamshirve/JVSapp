import { useEffect, useState } from "react";
import { api, inr } from "@/lib/api";
import { PageHeader, Card, EmptyState } from "@/components/Shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardList, Printer, CalendarDays, X } from "lucide-react";

export default function AdminPurchaseList() {
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

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

  // Print only the Excel-like preview table
  const handlePrint = () => {
    const printContent = document.getElementById("excel-print-area");
    if (!printContent) return;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase List - ${data?.date || ""}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { margin: 0 0 4px 0; font-size: 16px; }
            p { margin: 0 0 12px 0; font-size: 12px; color: #555; }
            table { border-collapse: collapse; width: 100%; font-size: 13px; }
            th {
              background: #1d4e3a;
              color: white;
              border: 1px solid #999;
              padding: 7px 10px;
              text-align: left;
              font-weight: bold;
            }
            td {
              border: 1px solid #ccc;
              padding: 6px 10px;
              vertical-align: top;
            }
            tr:nth-child(even) td { background: #f5f9f7; }
            tr:hover td { background: #eaf3ee; }
            .num { text-align: right; }
            .total-row td {
              background: #1d4e3a;
              color: white;
              font-weight: bold;
              border: 1px solid #999;
            }
            .summary { margin-top: 16px; font-size: 12px; color: #333; }
            @media print {
              body { margin: 10px; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <p class="summary">Printed on: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
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
            onClick={() => setShowPrintPreview(true)}
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
            <span className="label-cap col-span-1">#</span>
            <span className="label-cap col-span-4">Vegetable</span>
            <span className="label-cap col-span-3 text-right">Total Qty</span>
            <span className="label-cap col-span-2 text-right">Rate</span>
            <span className="label-cap col-span-2 text-right">Est. Cost</span>
          </div>
          <div className="divide-y divide-border">
            {data.items.map((it, idx) => (
              <div key={it.vegetable_id} data-testid={`purchase-row-${it.vegetable_id}`} className="grid grid-cols-12 px-5 py-3.5 items-center">
                <span className="col-span-1 text-sm text-muted-foreground">{idx + 1}</span>
                <div className="col-span-4">
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
          {/* Total row */}
          <div className="grid grid-cols-12 px-5 py-3 border-t-2 border-border bg-secondary/40">
            <span className="col-span-5 font-semibold text-sm">Total Estimated Cost</span>
            <span className="col-span-7 text-right font-heading font-extrabold text-primary text-lg">{inr(data.total_amount)}</span>
          </div>
        </Card>
      )}

      {/* ── Print Preview Dialog ── */}
      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-4xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center justify-between">
              <span>Print Preview — Purchase List</span>
            </DialogTitle>
          </DialogHeader>

          {/* Excel-like table preview */}
          <div id="excel-print-area">
            <h2 style={{ margin: "0 0 4px 0", fontSize: "16px", fontFamily: "Arial, sans-serif" }}>
              Jivdani Vegetable Suppliers — Purchase List
            </h2>
            <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#555", fontFamily: "Arial, sans-serif" }}>
              Delivery Date: {data?.date} &nbsp;|&nbsp; {data?.order_count} Order(s) from {data?.restaurant_count} Restaurant(s)
            </p>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px", fontFamily: "Arial, sans-serif" }}>
              <thead>
                <tr>
                  <th style={{ background: "#1d4e3a", color: "white", border: "1px solid #999", padding: "7px 10px", textAlign: "left" }}>#</th>
                  <th style={{ background: "#1d4e3a", color: "white", border: "1px solid #999", padding: "7px 10px", textAlign: "left" }}>Vegetable</th>
                  <th style={{ background: "#1d4e3a", color: "white", border: "1px solid #999", padding: "7px 10px", textAlign: "right" }}>Total Qty</th>
                  <th style={{ background: "#1d4e3a", color: "white", border: "1px solid #999", padding: "7px 10px", textAlign: "right" }}>Unit</th>
                  <th style={{ background: "#1d4e3a", color: "white", border: "1px solid #999", padding: "7px 10px", textAlign: "right" }}>Rate (₹)</th>
                  <th style={{ background: "#1d4e3a", color: "white", border: "1px solid #999", padding: "7px 10px", textAlign: "right" }}>Est. Cost (₹)</th>
                  <th style={{ background: "#1d4e3a", color: "white", border: "1px solid #999", padding: "7px 10px", textAlign: "left" }}>Restaurants</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).map((it, idx) => (
                  <tr key={it.vegetable_id}>
                    <td style={{ border: "1px solid #ccc", padding: "6px 10px", background: idx % 2 === 0 ? "white" : "#f5f9f7" }}>{idx + 1}</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontWeight: "600", background: idx % 2 === 0 ? "white" : "#f5f9f7" }}>{it.name}</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px 10px", textAlign: "right", fontWeight: "bold", background: idx % 2 === 0 ? "white" : "#f5f9f7" }}>{it.total_qty}</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px 10px", textAlign: "right", color: "#666", background: idx % 2 === 0 ? "white" : "#f5f9f7" }}>{it.unit}</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px 10px", textAlign: "right", background: idx % 2 === 0 ? "white" : "#f5f9f7" }}>&#8377;{Number(it.rate || 0).toLocaleString("en-IN")}</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px 10px", textAlign: "right", fontWeight: "600", background: idx % 2 === 0 ? "white" : "#f5f9f7" }}>&#8377;{Number(it.est_amount || 0).toLocaleString("en-IN")}</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: "11px", color: "#666", background: idx % 2 === 0 ? "white" : "#f5f9f7" }}>{it.restaurants} restaurant{it.restaurants > 1 ? "s" : ""}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="total-row">
                  <td colSpan="5" style={{ border: "1px solid #999", padding: "7px 10px", background: "#1d4e3a", color: "white", fontWeight: "bold" }}>Total Estimated Cost</td>
                  <td style={{ border: "1px solid #999", padding: "7px 10px", textAlign: "right", background: "#1d4e3a", color: "white", fontWeight: "bold", fontSize: "14px" }}>&#8377;{Number(data?.total_amount || 0).toLocaleString("en-IN")}</td>
                  <td style={{ border: "1px solid #999", padding: "7px 10px", background: "#1d4e3a", color: "white" }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-4 pt-4 border-t border-border">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all"
            >
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </button>
            <button
              onClick={() => setShowPrintPreview(false)}
              className="px-6 rounded-xl border border-input text-muted-foreground py-3 font-semibold hover:bg-secondary transition-all"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
