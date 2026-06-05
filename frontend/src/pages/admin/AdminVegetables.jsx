import { useEffect, useState } from "react";
import { api, formatApiError, inr } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Card, EmptyState } from "@/components/Shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Carrot, Plus, Pencil, Trash2, Power } from "lucide-react";

const empty = { name: "", unit: "kg", category: "General", rate: 0, active: true };

export default function AdminVegetables() {
  const [vegetables, setVegetables] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/vegetables").then((r) => setVegetables(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (v) => { setForm({ name: v.name, unit: v.unit, category: v.category, rate: v.rate, active: v.active }); setEditId(v.id); setOpen(true); };

  const save = async () => {
    try {
      if (editId) await api.put(`/vegetables/${editId}`, { ...form, rate: Number(form.rate) });
      else await api.post("/vegetables", { ...form, rate: Number(form.rate) });
      toast.success(editId ? "Vegetable updated" : "Vegetable added");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const toggleActive = async (v) => {
    await api.put(`/vegetables/${v.id}`, { active: !v.active });
    load();
  };

  const del = async (v) => {
    if (!window.confirm(`Delete ${v.name}?`)) return;
    await api.delete(`/vegetables/${v.id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div>
      <PageHeader
        title="Vegetables"
        subtitle="Manage your catalogue and base rates."
        action={
          <button
            data-testid="add-vegetable-button"
            onClick={openNew}
            className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold hover:bg-[#143a2e] hover:-translate-y-[1px] hover:shadow-md transition-all"
          >
            <Plus className="h-4 w-4" /> Add Vegetable
          </button>
        }
      />

      {vegetables.length === 0 ? (
        <Card><EmptyState icon={Carrot} title="No vegetables yet" subtitle="Add your first vegetable." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vegetables.map((v) => (
            <Card key={v.id} className={`p-4 ${!v.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading font-bold">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.category} · per {v.unit}</p>
                  <p className="text-primary font-semibold mt-1">{inr(v.rate)}</p>
                </div>
                <div className="flex gap-1">
                  <button data-testid={`toggle-veg-${v.id}`} onClick={() => toggleActive(v)} title="Toggle active" className="p-2 rounded-lg hover:bg-secondary">
                    <Power className={`h-4 w-4 ${v.active ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                  <button data-testid={`edit-veg-${v.id}`} onClick={() => openEdit(v)} className="p-2 rounded-lg hover:bg-secondary">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button data-testid={`delete-veg-${v.id}`} onClick={() => del(v)} className="p-2 rounded-lg hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-heading">{editId ? "Edit" : "Add"} Vegetable</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Inp label="Name" testid="veg-form-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Inp label="Unit" testid="veg-form-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <Inp label="Category" testid="veg-form-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <Inp label="Rate (₹)" testid="veg-form-rate" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            <button data-testid="veg-form-save" onClick={save} className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all">
              {editId ? "Save Changes" : "Add Vegetable"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Inp({ label, testid, type = "text", value, onChange }) {
  return (
    <div>
      <label className="label-cap">{label}</label>
      <input data-testid={testid} type={type} value={value} onChange={onChange}
        className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
    </div>
  );
}
