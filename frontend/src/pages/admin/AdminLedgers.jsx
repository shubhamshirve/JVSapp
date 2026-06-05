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
import { ReceiptText, Wallet } from "lucide-react";

export default function AdminLedgers() {
  const [ledgers, setLedgers] = useState([]);
  const [pay, setPay] = useState(null); // {id,name}
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const load = () => api.get("/admin/ledgers").then((r) => setLedgers(r.data));
  useEffect(() => { load(); }, []);

  const totalPending = ledgers.reduce((s, l) => s + l.pending, 0);

  const record = async () => {
    try {
      await api.post("/payments", { restaurant_id: pay.id, amount: Number(amount), note });
      toast.success("Payment recorded");
      setPay(null);
      setAmount("");
      setNote("");
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  return (
    <div>
      <PageHeader title="Ledgers" subtitle="Restaurant-wise billing and pending balances." />

      <Card className="p-5 mb-5 flex items-center justify-between">
        <div>
          <p className="label-cap">Total Outstanding</p>
          <p className="font-heading text-3xl font-extrabold text-[#9c531f] mt-1">{inr(totalPending)}</p>
        </div>
        <Wallet className="h-8 w-8 text-[#9c531f]/50" />
      </Card>

      {ledgers.length === 0 ? (
        <Card><EmptyState icon={ReceiptText} title="No restaurants yet" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-border">
            <span className="label-cap col-span-4">Restaurant</span>
            <span className="label-cap col-span-2 text-right">Billed</span>
            <span className="label-cap col-span-2 text-right">Paid</span>
            <span className="label-cap col-span-2 text-right">Pending</span>
            <span className="label-cap col-span-2 text-right">Action</span>
          </div>
          <div className="divide-y divide-border">
            {ledgers.map((l) => (
              <div key={l.id} data-testid={`ledger-row-${l.id}`} className="grid grid-cols-2 sm:grid-cols-12 gap-2 px-5 py-4 items-center">
                <div className="col-span-2 sm:col-span-4">
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-sm text-muted-foreground">{l.email}</p>
                </div>
                <div className="sm:col-span-2 sm:text-right">
                  <span className="sm:hidden label-cap">Billed </span>{inr(l.billed)}
                </div>
                <div className="sm:col-span-2 sm:text-right text-[#2f6b40]">
                  <span className="sm:hidden label-cap">Paid </span>{inr(l.paid)}
                </div>
                <div className="sm:col-span-2 sm:text-right font-semibold text-[#9c531f]">
                  <span className="sm:hidden label-cap">Pending </span>{inr(l.pending)}
                </div>
                <div className="col-span-2 sm:col-span-2 sm:text-right">
                  <button
                    data-testid={`record-payment-${l.id}`}
                    onClick={() => setPay({ id: l.id, name: l.name, pending: l.pending })}
                    className="rounded-lg border border-primary text-primary px-3 py-1.5 text-sm font-semibold hover:bg-primary/10 transition-all"
                  >
                    Record Payment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={!!pay} onOpenChange={(v) => !v && setPay(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="font-heading">Record Payment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            {pay?.name} · Pending {inr(pay?.pending)}
          </p>
          <div className="space-y-3 mt-1">
            <div>
              <label className="label-cap">Amount (₹)</label>
              <input data-testid="payment-amount-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="label-cap">Note (optional)</label>
              <input data-testid="payment-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cash / UPI / Cheque"
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <button data-testid="save-payment-button" onClick={record} className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all">
              Save Payment
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
