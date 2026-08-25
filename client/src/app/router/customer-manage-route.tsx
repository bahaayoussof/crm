import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { canManageCustomers } from "@/features/customers/customer-permissions";

export function CustomerManageRoute() {
  const { user } = useAuth();
  return user && canManageCustomers(user.role) ? <Outlet /> : <Navigate to="/customers" replace />;
}
