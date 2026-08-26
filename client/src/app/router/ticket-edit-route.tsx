import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { canManageTicketDefinition } from "@/features/tickets/ticket-permissions";

export function TicketEditRoute() {
  const { user } = useAuth();
  const { id = "" } = useParams();
  return user && canManageTicketDefinition(user.role) ? <Outlet /> : <Navigate to={`/tickets/${id}`} replace />;
}
