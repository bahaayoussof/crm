import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { canManageUsers } from "@/features/users/user-permissions";

export function UserManageRoute() {
  const { user } = useAuth();
  return user && canManageUsers(user.role) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
