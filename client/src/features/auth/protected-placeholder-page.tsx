import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth-state";

export function ProtectedPlaceholderPage({ area }: { area: "dashboard" | "portal" }) {
  const { t } = useTranslation(); const { user, logout } = useAuth(); const navigate = useNavigate();
  return <main className="grid min-h-screen place-items-center px-4"><section className="text-center"><h1 className="text-2xl font-semibold">{t(`auth.${area}Placeholder`)}</h1><p className="mt-2 text-muted-foreground">{t("auth.signedInAs", { name: user?.name })}</p>{area === "dashboard" && <Link className="button-link mt-6 inline-block" to="/customers">{t("customers.title")}</Link>}<button className="mt-6 block w-full text-sm font-medium text-primary" onClick={() => { logout(); navigate("/login", { replace: true }); }}>{t("auth.logout")}</button></section></main>;
}
