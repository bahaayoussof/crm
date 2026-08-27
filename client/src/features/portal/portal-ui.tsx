import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useAuth } from "@/features/auth/auth-state";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { PortalTicketStatus } from "./portal.types";
import { getPortalNavigationKey } from "./portal-navigation";

const navigation = [
  { to: "/portal", key: "home" },
  { to: "/portal/tickets", key: "requests" },
  { to: "/portal/tickets/new", key: "newRequest" },
  { to: "/portal/knowledge-base", key: "knowledgeBase" },
] as const;

export function PortalShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const activeKey = getPortalNavigationKey(useLocation().pathname);

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

    return (
      <div className="min-h-[100dvh] bg-background text-foreground">
        <header className="border-b bg-white" data-testid="portal-header">
          <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
            <Link
              to="/portal"
              className="me-auto min-h-10 content-center text-base font-semibold tracking-tight focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {t("portal.brand")}
            </Link>

            <nav
              aria-label={t("portal.navigation")}
              className="order-last flex w-full justify-center gap-1 overflow-x-auto pt-1 sm:absolute sm:left-1/2 sm:top-1/2 sm:order-none sm:w-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:pt-0"
            >
              {navigation.map((item) => {
                const active = item.key === activeKey;
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-10 shrink-0 items-center px-3 text-sm font-medium transition-colors focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"}`}
                    key={item.to}
                    to={item.to}
                  >
                    {t(`portal.nav.${item.key}`)}
                  </Link>
                );
              })}
            </nav>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="hidden max-w-40 truncate text-sm font-medium md:inline"
                dir="auto"
              >
                {user?.name}
              </span>
              <button className="button-ghost px-2 text-xs" onClick={signOut}>
                {t("auth.logout")}
              </button>
            </div>

            <LanguageSwitcher />
          </div>
        </header>
        <Outlet />
      </div>
    );
}

export function PortalPage({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>;
}

export function PortalPageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>
    {action && <div className="shrink-0">{action}</div>}
  </header>;
}

// Mirrors the internal `TicketStatusBadge` visual (bordered, colour-coded pill)
// so the two ticket views read as one system. Keyed by the customer-facing
// status vocabulary, not the internal `TicketStatus` enum.
const portalStatusStyles: Record<PortalTicketStatus, string> = {
  OPEN: "border-blue-200 bg-blue-50 text-blue-700",
  IN_PROGRESS: "border-violet-200 bg-violet-50 text-violet-700",
  WAITING_FOR_YOU: "border-amber-200 bg-amber-50 text-amber-800",
  RESOLVED: "border-green-200 bg-green-50 text-green-700",
  CLOSED: "border-gray-300 bg-gray-100 text-gray-800",
};
export function PortalStatus({ status }: { status: PortalTicketStatus }) {
  const { t } = useTranslation();
  return <span className={`inline-flex w-fit rounded-md border px-2 py-0.5 text-xs font-medium ${portalStatusStyles[status]}`}>{t(`portal.status.${status}`)}</span>;
}

export function PortalState({ children, retry }: { children: React.ReactNode; retry?: () => void }) {
  const { t } = useTranslation();
  return <section className="mt-6 rounded-md border bg-white p-8 text-center" role={retry ? "alert" : undefined}>
    <p className="text-sm text-muted-foreground">{children}</p>
    {retry && <button className="button-secondary mt-4" onClick={retry}>{t("common.retry")}</button>}
  </section>;
}

export const TicketRef = ({ id }: { id: string }) => <bdi dir="ltr" className="font-mono text-xs font-medium">#{id.slice(-8).toUpperCase()}</bdi>;
