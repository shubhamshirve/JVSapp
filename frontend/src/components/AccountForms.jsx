import { useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Card } from "@/components/Shared";
import { Save, KeyRound, Eye, EyeOff, UserCog } from "lucide-react";

const labelCls = "text-xs font-semibold tracking-wide uppercase text-muted-foreground";
const inputCls =
  "mt-1.5 block w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";
const btnCls =
  "flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold hover:bg-[#143a2e] hover:-translate-y-[1px] hover:shadow-md transition-all disabled:opacity-60";

export function ProfileCard() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/auth/me", { name, phone, address });
      await refresh();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="font-heading text-lg font-bold flex items-center gap-2">
        <UserCog className="h-5 w-5 text-primary" /> Profile details
      </h3>
      <p className="text-sm text-muted-foreground mt-1">
        Your display name and contact info. Email cannot be changed.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div>
          <label className={labelCls}>Name</label>
          <input
            data-testid="profile-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input
            value={user?.email || ""}
            disabled
            className={`${inputCls} bg-secondary/50 cursor-not-allowed`}
          />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input
            data-testid="profile-phone-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Address</label>
          <textarea
            data-testid="profile-address-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </div>
      </div>

      <button
        data-testid="save-profile-button"
        onClick={save}
        disabled={saving || !name.trim()}
        className={`mt-6 ${btnCls}`}
      >
        <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save profile"}
      </button>
    </Card>
  );
}

export function ChangePasswordCard() {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (newPwd.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPwd,
        new_password: newPwd,
      });
      toast.success("Password changed");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const Eye_ = show ? EyeOff : Eye;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Change password
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Use at least 6 characters. You&apos;ll stay logged in after the change.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 shrink-0"
          data-testid="toggle-password-visibility"
        >
          <Eye_ className="h-4 w-4" /> {show ? "Hide" : "Show"}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div className="sm:col-span-2">
          <label className={labelCls}>Current password</label>
          <input
            data-testid="current-password-input"
            type={show ? "text" : "password"}
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            className={inputCls}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className={labelCls}>New password</label>
          <input
            data-testid="new-password-input"
            type={show ? "text" : "password"}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className={labelCls}>Confirm new password</label>
          <input
            data-testid="confirm-password-input"
            type={show ? "text" : "password"}
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
      </div>

      <button
        data-testid="change-password-button"
        onClick={submit}
        disabled={saving || !currentPwd || !newPwd || !confirmPwd}
        className={`mt-6 ${btnCls}`}
      >
        <KeyRound className="h-4 w-4" /> {saving ? "Updating..." : "Update password"}
      </button>
    </Card>
  );
}
