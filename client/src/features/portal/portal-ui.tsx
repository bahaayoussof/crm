import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { ticketReference } from "@/features/tickets/ticket-format";
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

/** Portal ticket reference chip. Formatting comes from the shared
 * `ticketReference()` helper — only the portal-specific styling lives here. */
export const TicketRef = ({ id }: { id: string }) => (
  <bdi dir="ltr" className="font-mono text-xs font-medium text-muted-foreground">
    {ticketReference(id)}
  </bdi>
);
