import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { getProtectedRedirect, type ProtectedAudience } from "@/features/auth/auth-routing";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/app/layouts/app-shell";

export function ProtectedRoute({ audience }: { audience: ProtectedAudience }) {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  if (isLoading) return <main className="grid h-full place-items-center bg-background px-4"><div className="w-full max-w-sm" aria-label={t("common.loading")}><div className="h-4 w-28 animate-pulse rounded bg-muted" /><div className="mt-4 h-10 animate-pulse rounded bg-muted" /><div className="mt-3 h-10 animate-pulse rounded bg-muted" /></div></main>;
  const redirect = getProtectedRedirect(user, audience);
  if (redirect) return <Navigate to={redirect} replace />;
  return <AppShell audience={audience}><Outlet /></AppShell>;
}
