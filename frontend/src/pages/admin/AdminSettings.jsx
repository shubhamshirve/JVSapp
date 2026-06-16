import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Card } from "@/components/Shared";
import { ChangePasswordCard } from "@/components/AccountForms";
import { Clock, Save, Lock, Unlock } from "lucide-react";

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("20:00");
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get("/settings").then((r) => {
      setSettings(r.data);
      setEnabled(r.data.cutoff_enabled);
      setTime(r.data.cutoff_time);
    });
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/settings", { cutoff_enabled: enabled, cutoff_time: time });
      setSettings(data);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Control ordering rules and manage your account." />
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-heading text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Daily order cut-off
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              After the cut-off time each day, restaurants can't place new orders — your morning
              purchase list locks automatically. Times are in IST (Asia/Kolkata).
            </p>
          </div>
          <button
            data-testid="cutoff-toggle"
            onClick={() => setEnabled(!enabled)}
            aria-pressed={enabled}
            className={`relative h-7 w-12 rounded-full transition-all shrink-0 ${enabled ? "bg-primary" : "bg-secondary"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-6" : "left-1"}`} />
          </button>
        </div>

        <div className={`mt-5 transition-all ${enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <label className="label-cap">Cut-off time (IST)</label>
          <input
            data-testid="cutoff-time-input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1.5 block rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          {settings.cutoff_enabled && settings.is_locked ? (
            <span data-testid="lock-status" className="flex items-center gap-1.5 text-[#9c531f] font-medium">
              <Lock className="h-4 w-4" /> Ordering is currently LOCKED
            </span>
          ) : (
            <span data-testid="lock-status" className="flex items-center gap-1.5 text-[#2f6b40] font-medium">
              <Unlock className="h-4 w-4" /> Ordering is currently OPEN
            </span>
          )}
          <span className="text-muted-foreground">· Server time (IST): {settings.server_time}</span>
        </div>

        <button
          data-testid="save-settings-button"
          onClick={save}
          disabled={saving}
          className="mt-6 flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold hover:bg-[#143a2e] hover:-translate-y-[1px] hover:shadow-md transition-all disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> Save Settings
        </button>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
