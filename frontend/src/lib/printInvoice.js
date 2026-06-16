/**
 * printInvoice(order)
 * Opens a new browser window with a formatted invoice and auto-triggers print.
 */
export function printInvoice(order) {
  const invoiceNo = `#${order.id.slice(-8).toUpperCase()}`;
  const formatDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return d; }
  };
  const inr = (n) =>
    "\u20B9" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const rows = (order.items || []).map((i) => {
    const amt = (Number(i.qty) * Number(i.rate || 0)).toFixed(2);
    return `
      <tr>
        <td>${i.name}</td>
        <td class="center">${i.qty} ${i.unit || "kg"}</td>
        <td class="right">${inr(i.rate)}</td>
        <td class="right bold">${inr(amt)}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoiceNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12pt;
      color: #111;
      background: #fff;
      padding: 20mm;
    }
    /* Header */
    .header { text-align: center; border-bottom: 3px solid #1B4D3E; padding-bottom: 10px; margin-bottom: 18px; }
    .header h1 { font-size: 20pt; color: #1B4D3E; letter-spacing: 1px; }
    .header p { font-size: 10pt; color: #555; margin-top: 3px; }
    /* Meta table */
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    .meta td { padding: 5px 8px; font-size: 11pt; }
    .meta .label { font-weight: bold; color: #444; width: 120px; }
    .meta .divider { width: 40px; text-align: center; color: #888; }
    /* Items table */
    .items { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .items th {
      background: #1B4D3E;
      color: #fff;
      padding: 8px 10px;
      text-align: left;
      font-size: 11pt;
    }
    .items td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11pt; }
    .items tr:nth-child(even) td { background: #f7faf8; }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    /* Total row */
    .total-row { text-align: right; font-size: 14pt; font-weight: bold; color: #1B4D3E; margin-top: 8px; }
    /* Footer */
    .footer { margin-top: 30px; font-size: 9pt; color: #777; border-top: 1px solid #ddd; padding-top: 8px; text-align: center; }
    /* Status badge */
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 10pt;
      font-weight: bold;
      background: #d1fae5;
      color: #065f46;
    }
    @media print {
      body { padding: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>JIVDANI VEGETABLE SUPPLIERS</h1>
    <p>Delivery Invoice / Challan</p>
  </div>

  <table class="meta">
    <tr>
      <td class="label">Invoice No.</td>
      <td class="divider">:</td>
      <td><strong>${invoiceNo}</strong></td>
      <td class="label">Invoice Date</td>
      <td class="divider">:</td>
      <td>${formatDate(order.order_date)}</td>
    </tr>
    <tr>
      <td class="label">Restaurant</td>
      <td class="divider">:</td>
      <td><strong>${order.restaurant_name || "—"}</strong></td>
      <td class="label">Delivery Date</td>
      <td class="divider">:</td>
      <td>${formatDate(order.delivery_date)}</td>
    </tr>
    <tr>
      <td class="label">Status</td>
      <td class="divider">:</td>
      <td><span class="badge">${order.status || "—"}</span></td>
      <td></td><td></td><td></td>
    </tr>
  </table>

  <table class="items">
    <thead>
      <tr>
        <th>Item</th>
        <th class="center">Qty / Unit</th>
        <th class="right">Rate (\u20B9)</th>
        <th class="right">Amount (\u20B9)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="total-row">Total: ${inr(order.total)}</div>

  <div class="footer">
    Jivdani Vegetable Suppliers &mdash; Thank you for your business!<br/>
    This is a computer-generated invoice.
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=850,height=1100");
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups for this site to print invoices.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
