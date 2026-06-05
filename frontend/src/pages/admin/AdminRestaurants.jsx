import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/Shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Store, Plus, Check, Phone, MapPin, Trash2, Pencil, Search } from "lucide-react";

const empty = { name: "", email: "", password: "", phone: "", address: "" };

export default function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "", password: "" });

  const load = () => api.get("/restaurants").then((r) => setRestaurants(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post("/restaurants", form);
      toast.success("Restaurant account created");
      setOpen(false);
      setForm(empty);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const approve = async (r) => {
    await api.put(`/restaurants/${r.id}`, { status: "active" });
    toast.success(`${r.name} approved`);
    load();
  };

  const del = async (r) => {
    if (!window.confirm(`Delete ${r.name}? This cannot be undone.`)) return;
    await api.delete(`/restaurants/${r.id}`);
    toast.success("Deleted");
    load();
  };

  const openEdit = (r) => {
    setEditing(r);
    setEditForm({ name: r.name, phone: r.phone || "", address: r.address || "", password: "" });
  };

  const saveEdit = async () => {
    try {
      const payload = { name: editForm.name, phone: editForm.phone, address: editForm.address };
      if (editForm.password) payload.password = editForm.password;
      await api.put(`/restaurants/${editing.id}`, payload);
      toast.success("Restaurant updated");
      setEditing(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const pending = restaurants.filter((r) => r.status === "pending");
  const filtered = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Restaurants"
        subtitle="Create accounts, approve registrations and manage tie-ups."
        action={
          <button
            data-testid="add-restaurant-button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold hover:bg-[#143a2e] hover:-translate-y-[1px] hover:shadow-md transition-all"
          >
            <Plus className="h-4 w-4" /> Add Restaurant
          </button>
        }
      />

      {pending.length > 0 && (
        <div className="mb-6">
          <p className="label-cap mb-2">Pending Approvals ({pending.length})</p>
          <div className="space-y-2">
            {pending.map((r) => (
              <Card key={r.id} className="p-4 flex items-center justify-between gap-3 border-[#D27D46]/40">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted-foreground">{r.email}</p>
                </div>
                <button
                  data-testid={`approve-restaurant-${r.id}`}
                  onClick={() => approve(r)}
                  className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-[#143a2e] transition-all"
                >
                  <Check className="h-4 w-4" /> Approve
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {restaurants.length === 0 ? (
        <Card><EmptyState icon={Store} title="No restaurants yet" subtitle="Add your first restaurant tie-up." /></Card>
      ) : (
        <>
        <div className="relative mb-5 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            data-testid="restaurant-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-input bg-white pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-heading font-bold truncate">{r.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{r.email}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {r.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {r.phone}</p>}
                {r.address && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {r.address}</p>}
              </div>
              <div className="mt-4 flex items-center gap-4">
                <button
                  data-testid={`edit-restaurant-${r.id}`}
                  onClick={() => openEdit(r)}
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  data-testid={`delete-restaurant-${r.id}`}
                  onClick={() => del(r)}
                  className="flex items-center gap-1.5 text-sm text-destructive hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-heading">Add Restaurant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Inp label="Restaurant Name" testid="rest-form-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Inp label="Email (login)" testid="rest-form-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Inp label="Password" testid="rest-form-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Inp label="Phone" testid="rest-form-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Inp label="Address" testid="rest-form-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <button data-testid="rest-form-save" onClick={create} className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all">
              Create Account
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-heading">Edit · {editing?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Inp label="Restaurant Name" testid="edit-rest-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            <Inp label="Phone" testid="edit-rest-phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            <Inp label="Address" testid="edit-rest-address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            <Inp label="New Password (optional)" testid="edit-rest-password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
            <button data-testid="edit-rest-save" onClick={saveEdit} className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] transition-all">
              Save Changes
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
