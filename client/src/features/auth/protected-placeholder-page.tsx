import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "./auth-state";

export function ProtectedPlaceholderPage({ area }: { area: "dashboard" | "portal" }) {
  const { t } = useTranslation(); const { user } = useAuth();
  return <main className="page-container"><header className="border-b pb-5"><h1 className="text-2xl font-semibold tracking-tight">{t(`auth.${area}Placeholder`)}</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{t("auth.signedInAs", { name: user?.name })}</p></header>{area === "dashboard" && <section className="mt-6 border-s-2 border-primary/40 ps-4"><h2 className="text-sm font-semibold">{t("customers.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("customers.description")}</p><Link className="button-secondary mt-4 inline-flex" to="/customers">{t("navigation.openCustomers")}</Link></section>}</main>;
}
