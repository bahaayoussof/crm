import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { canManageQuickReplies } from "@/features/quick-replies/quick-reply-permissions";

export function QuickReplyManageRoute() {
  const { user } = useAuth();
  return user && canManageQuickReplies(user.role) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
