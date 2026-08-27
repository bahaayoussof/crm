import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/auth-state";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { PortalTicketStatus } from "./portal.types";
import { getPortalNavigationKey } from "./portal-navigation";
import { cn } from "@/lib/utils";

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
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-xs shadow-xs" data-testid="portal-header">
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <Link
            to="/portal"
            className="me-auto flex items-center gap-2.5 min-h-10 text-base font-semibold tracking-tight text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-xs">
              CS
            </div>
            <span>{t("portal.brand")}</span>
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
                  className={cn(
                    "inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-xs font-medium transition-colors select-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    active
                      ? "bg-primary-subtle text-primary font-semibold"
                      : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                  )}
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
              className="hidden max-w-40 truncate text-xs font-medium text-muted-foreground md:inline"
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
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

const portalStatusVariants: Record<PortalTicketStatus, "info" | "progress" | "warning" | "success" | "neutral"> = {
  OPEN: "info",
  IN_PROGRESS: "progress",
  WAITING_FOR_YOU: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export function PortalStatus({ status }: { status: PortalTicketStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={portalStatusVariants[status]} size="default">
      {t(`portal.status.${status}`)}
    </Badge>
  );
}

export function PortalState({ children, retry }: { children: React.ReactNode; retry?: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-8 text-center shadow-subtle" role={retry ? "alert" : undefined}>
      <p className="text-sm text-muted-foreground">{children}</p>
      {retry && <button className="button-secondary mt-4" onClick={retry}>{t("common.retry")}</button>}
    </section>
  );
}

export const TicketRef = ({ id }: { id: string }) => (
  <bdi dir="ltr" className="font-mono text-xs font-semibold text-primary">
    #{id.slice(-8).toUpperCase()}
  </bdi>
);
