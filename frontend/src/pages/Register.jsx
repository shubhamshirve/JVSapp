import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { Leaf, Loader2, CheckCircle2 } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      setDone(true);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md text-center animate-fadeup">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Registration submitted!</h1>
          <p className="text-muted-foreground mt-2">
            Your account is awaiting approval from Jivdani admin. You'll be able to log in and place
            orders once approved.
          </p>
          <Link
            to="/login"
            data-testid="back-to-login-link"
            className="inline-block mt-6 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold hover:bg-[#143a2e] transition-all"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md animate-fadeup">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-heading font-extrabold text-lg text-primary">Jivdani</p>
            <p className="text-xs text-muted-foreground -mt-1">Vegetable Suppliers</p>
          </div>
        </div>

        <h1 className="font-heading text-2xl font-bold tracking-tight text-center">
          Register your restaurant
        </h1>
        <p className="text-muted-foreground mt-1 mb-7 text-center text-sm">
          Create an account to start ordering fresh vegetables daily.
        </p>

        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Restaurant Name" testid="reg-name" value={form.name} onChange={set("name")} required />
          <Field label="Email" type="email" testid="reg-email" value={form.email} onChange={set("email")} required />
          <Field label="Password" type="password" testid="reg-password" value={form.password} onChange={set("password")} required />
          <Field label="Phone" testid="reg-phone" value={form.phone} onChange={set("phone")} />
          <Field label="Address" testid="reg-address" value={form.address} onChange={set("address")} />

          {error && (
            <p data-testid="register-error" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            data-testid="register-submit-button"
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] hover:-translate-y-[1px] hover:shadow-md transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Account
          </button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Already registered?{" "}
          <Link to="/login" data-testid="goto-login-link" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, testid, type = "text", value, onChange, required }) {
  return (
    <div>
      <label className="label-cap">{label}</label>
      <input
        data-testid={testid}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
      />
    </div>
  );
}
