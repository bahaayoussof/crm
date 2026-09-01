import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { canUseManagerConsole } from "@/features/manager/manager-permissions";

/**
 * Guards `/manager/*`. MANAGER (primary) and ADMIN (supervision) may enter;
 * everyone else is redirected. Server-side `requireRole(ADMIN, MANAGER)` on
 * `/api/manager/*` is the authoritative boundary.
 */
export function ManagerRoute() {
  const { user } = useAuth();
  return user && canUseManagerConsole(user.role) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
