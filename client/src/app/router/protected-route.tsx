import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { getProtectedRedirect, type ProtectedAudience } from "@/features/auth/auth-routing";

export function ProtectedRoute({ audience }: { audience: ProtectedAudience }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <main className="grid min-h-screen place-items-center">Loading…</main>;
  const redirect = getProtectedRedirect(user, audience);
  return redirect ? <Navigate to={redirect} replace /> : <Outlet />;
}
