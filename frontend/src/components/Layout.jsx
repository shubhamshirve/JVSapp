import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  ShoppingBasket,
  ScrollText,
  Carrot,
  Tags,
  Store,
  ReceiptText,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Leaf,
} from "lucide-react";

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Orders", icon: ScrollText },
  { to: "/admin/purchase-list", label: "Purchase List", icon: ClipboardList },
  { to: "/admin/rates", label: "Daily Rates", icon: Tags },
  { to: "/admin/vegetables", label: "Vegetables", icon: Carrot },
  { to: "/admin/restaurants", label: "Restaurants", icon: Store },
  { to: "/admin/ledgers", label: "Ledgers", icon: ReceiptText },
];

const restNav = [
  { to: "/order", label: "Place Order", icon: ShoppingBasket },
  { to: "/my-orders", label: "My Orders", icon: ScrollText },
  { to: "/my-ledger", label: "My Ledger", icon: ReceiptText },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const nav = user?.role === "admin" ? adminNav : restNav;

  const NavLinks = () => (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = location.pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-[#3a423c] hover:bg-secondary"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const Brand = () => (
    <div className="flex items-center gap-2.5 px-2">
      <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
        <Leaf className="h-5 w-5 text-primary-foreground" />
      </div>
      <div className="leading-tight">
        <p className="font-heading font-extrabold text-[15px] text-primary">Jivdani</p>
        <p className="text-[10px] tracking-wide text-muted-foreground -mt-0.5">
          Vegetable Suppliers
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card py-6 px-3 gap-8 fixed h-screen">
        <Brand />
        <div className="flex-1">
          <NavLinks />
        </div>
        <div className="px-2">
          <div className="px-2 pb-3">
            <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            data-testid="logout-button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 w-full transition-all duration-200"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-16 bg-card border-b border-border">
        <Brand />
        <button
          data-testid="mobile-menu-toggle"
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg hover:bg-secondary"
        >
          <Menu className="h-6 w-6 text-foreground" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-card p-4 flex flex-col gap-6 animate-fadeup">
            <div className="flex items-center justify-between">
              <Brand />
              <button onClick={() => setOpen(false)} className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1">
              <NavLinks />
            </div>
            <button
              data-testid="logout-button-mobile"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
