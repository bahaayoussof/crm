import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { PortalTicketStatus } from "./portal.types";

/**
 * Portal page wrapper. Deliberately the same one-liner as the internal
 * `CustomerPage` / `TicketPage` / etc. wrappers — the shared `.page-container`
 * spacing system, not a customer-specific layout primitive.
 */
export function PortalPage({ children }: { children: React.ReactNode }) {
  return <main className="page-container">{children}</main>;
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
    <section className="mt-6 flex flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center" role={retry ? "alert" : undefined}>
      <p className="text-sm text-muted-foreground">{children}</p>
      {retry && <button className="button-secondary mt-4" onClick={retry}>{t("common.retry")}</button>}
    </section>
  );
}

export const TicketRef = ({ id }: { id: string }) => (
  <bdi dir="ltr" className="font-mono text-xs font-medium text-muted-foreground">
    #{id.slice(-8).toUpperCase()}
  </bdi>
);
