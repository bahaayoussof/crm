import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Minus, ArrowUp } from "lucide-react";
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

const priorityConfig: Record<TicketPriority, { icon: typeof ArrowDown; color: string }> = {
  LOW: { icon: ArrowDown, color: "text-muted-foreground" },
  MEDIUM: { icon: Minus, color: "text-info-foreground" },
  HIGH: { icon: ArrowUp, color: "text-warning-foreground" },
  URGENT: { icon: ArrowUp, color: "text-danger-foreground font-semibold" },
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
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      <span>{t(`tickets.priority.${priority}`)}</span>
    </span>
  );
}
