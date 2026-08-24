import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { getProtectedRedirect, type ProtectedAudience } from "@/features/auth/auth-routing";
import { useTranslation } from "react-i18next";

export function ProtectedRoute({ audience }: { audience: ProtectedAudience }) {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  if (isLoading) return <main className="grid min-h-screen place-items-center">{t("common.loading")}</main>;
  const redirect = getProtectedRedirect(user, audience);
  return redirect ? <Navigate to={redirect} replace /> : <Outlet />;
}
