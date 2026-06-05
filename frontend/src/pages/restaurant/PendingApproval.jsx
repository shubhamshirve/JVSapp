import { useAuth } from "@/context/AuthContext";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PendingApproval() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md text-center animate-fadeup">
        <div className="h-16 w-16 rounded-2xl bg-[#D27D46]/15 flex items-center justify-center mx-auto mb-5">
          <Clock className="h-8 w-8 text-[#D27D46]" />
        </div>
        <h1 className="font-heading text-2xl font-bold">Awaiting approval</h1>
        <p className="text-muted-foreground mt-2">
          Hi {user?.name}, your account is pending approval from Jivdani admin. Once approved you can
          start placing orders.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <button
            data-testid="pending-refresh-button"
            onClick={() => refresh()}
            className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 font-semibold hover:bg-[#143a2e] transition-all"
          >
            <RefreshCw className="h-4 w-4" /> Check again
          </button>
          <button
            data-testid="pending-logout-button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 font-semibold hover:bg-secondary transition-all"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}
