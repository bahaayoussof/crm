import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { TicketPriority, TicketStatus } from "./ticket.types";

const statusVariants: Record<TicketStatus, "neutral" | "info" | "progress" | "warning" | "success" | "danger"> = {
  NEW: "neutral",
  OPEN: "info",
  IN_PROGRESS: "progress",
  WAITING_CUSTOMER: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
  ESCALATED: "danger",
};

const priorityStyles: Record<TicketPriority, string> = {
  LOW: "text-muted-foreground font-normal",
  MEDIUM: "text-info-foreground font-medium",
  HIGH: "text-warning-foreground font-medium",
  URGENT: "text-danger-foreground font-semibold",
};

const priorityDotStyles: Record<TicketPriority, string> = {
  LOW: "bg-muted-foreground/50",
  MEDIUM: "bg-info",
  HIGH: "bg-warning",
  URGENT: "bg-danger animate-pulse",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={statusVariants[status]} size="default">
      {t(`tickets.status.${status}`)}
    </Badge>
  );
}

export function TicketPriorityText({ priority }: { priority: TicketPriority }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${priorityStyles[priority]}`}>
      <span className={`size-1.5 rounded-full shrink-0 ${priorityDotStyles[priority]}`} />
      <span>{t(`tickets.priority.${priority}`)}</span>
    </span>
  );
}
