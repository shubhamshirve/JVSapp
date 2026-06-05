import { useEffect, useState } from "react";
import { api, formatApiError, inr } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Card } from "@/components/Shared";
import { Save, Search } from "lucide-react";

export default function AdminRates() {
  const [vegetables, setVegetables] = useState([]);
  const [rates, setRates] = useState({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get("/vegetables").then((r) => {
      setVegetables(r.data);
      const map = {};
      r.data.forEach((v) => (map[v.id] = v.rate));
      setRates(map);
    });
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/vegetables/rates/bulk", {
        rates: vegetables.map((v) => ({ vegetable_id: v.id, rate: Number(rates[v.id]) || 0 })),
      });
      toast.success("Today's rates updated! New orders will use these rates.");
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const filtered = vegetables.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Daily Rates"
        subtitle="Set today's market rate (₹ per kg). Applied to all new orders."
        action={
          <button
            data-testid="save-rates-button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold hover:bg-[#143a2e] hover:-translate-y-[1px] hover:shadow-md transition-all disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> Save Rates
          </button>
        }
      />

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          data-testid="rates-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vegetables…"
          className="w-full rounded-xl border border-input bg-white pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((v) => (
          <Card key={v.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{v.name}</p>
              <p className="text-xs text-muted-foreground">{v.category} · per {v.unit}</p>
            </div>
            <div className="flex items-center gap-1.5 bg-secondary rounded-xl px-3 py-2 shrink-0">
              <span className="text-muted-foreground">₹</span>
              <input
                data-testid={`rate-input-${v.id}`}
                value={rates[v.id] ?? ""}
                onChange={(e) => setRates({ ...rates, [v.id]: e.target.value })}
                className="w-16 text-right font-semibold bg-transparent outline-none"
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
