import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Leaf, Loader2 } from "lucide-react";

const AUTH_BG =
  "https://images.unsplash.com/photo-1708796705570-33fd29ef67d0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwxfHxmYXJtJTIwZ3JlZW5ob3VzZSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHx8fHwxNzgwNjgzNjQ3fDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "admin" ? "/admin" : "/order");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:block lg:w-1/2 relative">
        <img src={AUTH_BG} alt="farm" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-primary/55" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <p className="font-heading font-extrabold text-xl">Jivdani</p>
              <p className="text-sm text-white/80 -mt-1">Vegetable Suppliers</p>
            </div>
          </div>
          <h2 className="font-heading text-3xl font-bold leading-snug max-w-md">
            Fresh vegetables, ordered in seconds.
          </h2>
          <p className="mt-3 text-white/85 max-w-md">
            Place your daily order, see live market rates and your bill instantly — delivered fresh
            next morning.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fadeup">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-heading font-extrabold text-lg text-primary">Jivdani</p>
              <p className="text-xs text-muted-foreground -mt-1">Vegetable Suppliers</p>
            </div>
          </div>

          <h1 className="font-heading text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1 mb-8">Sign in to manage your orders.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label-cap">Email</label>
              <input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="label-cap">Password</label>
              <input
                data-testid="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-xl border border-input bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            {error && (
              <p data-testid="login-error" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:bg-[#143a2e] hover:-translate-y-[1px] hover:shadow-md transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            New restaurant?{" "}
            <Link to="/register" data-testid="goto-register-link" className="text-primary font-semibold hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
