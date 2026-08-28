import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { PortalTicketStatus } from "./portal.types";

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
