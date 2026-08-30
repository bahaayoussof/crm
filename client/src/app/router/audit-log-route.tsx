import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
export function AuditLogRoute() { const { user } = useAuth(); return user?.role === "ADMIN" ? <Outlet /> : <Navigate to="/dashboard" replace />; }
