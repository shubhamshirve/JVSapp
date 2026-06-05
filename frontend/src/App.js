import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Layout from "@/components/Layout";
import RestaurantOrder from "@/pages/restaurant/RestaurantOrder";
import RestaurantOrders from "@/pages/restaurant/RestaurantOrders";
import RestaurantLedger from "@/pages/restaurant/RestaurantLedger";
import PendingApproval from "@/pages/restaurant/PendingApproval";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminRates from "@/pages/admin/AdminRates";
import AdminVegetables from "@/pages/admin/AdminVegetables";
import AdminRestaurants from "@/pages/admin/AdminRestaurants";
import AdminLedgers from "@/pages/admin/AdminLedgers";
import AdminPurchaseList from "@/pages/admin/AdminPurchaseList";

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm">Loading Jivdani…</p>
      </div>
    </div>
  );
}

function Protected({ role, children }) {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  if (user === false) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/order"} replace />;
  }
  if (user.role === "restaurant" && user.status !== "active") {
    return <PendingApproval />;
  }
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  if (user === false) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/order"} replace />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Restaurant */}
            <Route
              path="/order"
              element={
                <Protected role="restaurant">
                  <Layout>
                    <RestaurantOrder />
                  </Layout>
                </Protected>
              }
            />
            <Route
              path="/my-orders"
              element={
                <Protected role="restaurant">
                  <Layout>
                    <RestaurantOrders />
                  </Layout>
                </Protected>
              }
            />
            <Route
              path="/my-ledger"
              element={
                <Protected role="restaurant">
                  <Layout>
                    <RestaurantLedger />
                  </Layout>
                </Protected>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <Protected role="admin">
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </Protected>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <Protected role="admin">
                  <Layout>
                    <AdminOrders />
                  </Layout>
                </Protected>
              }
            />
            <Route
              path="/admin/rates"
              element={
                <Protected role="admin">
                  <Layout>
                    <AdminRates />
                  </Layout>
                </Protected>
              }
            />
            <Route
              path="/admin/vegetables"
              element={
                <Protected role="admin">
                  <Layout>
                    <AdminVegetables />
                  </Layout>
                </Protected>
              }
            />
            <Route
              path="/admin/restaurants"
              element={
                <Protected role="admin">
                  <Layout>
                    <AdminRestaurants />
                  </Layout>
                </Protected>
              }
            />
            <Route
              path="/admin/ledgers"
              element={
                <Protected role="admin">
                  <Layout>
                    <AdminLedgers />
                  </Layout>
                </Protected>
              }
            />
            <Route
              path="/admin/purchase-list"
              element={
                <Protected role="admin">
                  <Layout>
                    <AdminPurchaseList />
                  </Layout>
                </Protected>
              }
            />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
