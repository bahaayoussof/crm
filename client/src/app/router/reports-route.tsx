import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { canViewReports } from "@/features/reports/reports-permissions";

export function ReportsRoute() {
  const { user } = useAuth();
  return user && canViewReports(user.role) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
