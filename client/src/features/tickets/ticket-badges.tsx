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

const priorityConfig: Record<TicketPriority, { icon: typeof ArrowDown; iconColor: string; textColor: string }> = {
  LOW: { icon: ArrowDown, iconColor: "text-emerald-500 dark:text-emerald-400", textColor: "text-foreground/80 font-normal" },
  MEDIUM: { icon: Minus, iconColor: "text-muted-foreground", textColor: "text-foreground/80 font-medium" },
  HIGH: { icon: ArrowUp, iconColor: "text-warning", textColor: "text-warning font-medium" },
  URGENT: { icon: ArrowUp, iconColor: "text-danger", textColor: "text-danger font-semibold" },
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
    <span className={`inline-flex items-center gap-1 text-[11px] ${config.textColor}`}>
      <Icon className={`size-3 shrink-0 ${config.iconColor}`} strokeWidth={2.25} aria-hidden="true" />
      <span>{t(`tickets.priority.${priority}`)}</span>
    </span>
  );
}

export function SlaStatusDot({ state }: { state?: "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET" | "NOT_CONFIGURED" }) {
  const { t } = useTranslation();
  if (!state || state === "NOT_CONFIGURED") {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  const badgeStyles = {
    ON_TRACK: "border-success/20 bg-success-soft text-success-foreground",
    AT_RISK: "border-warning/20 bg-warning-soft text-warning-foreground",
    BREACHED: "border-danger/20 bg-danger-soft text-danger-foreground",
    MET: "border-success/20 bg-success-soft text-success-foreground",
  };

  const dotColors = {
    ON_TRACK: "bg-success",
    AT_RISK: "bg-warning",
    BREACHED: "bg-danger",
    MET: "bg-success",
  };

  const labels = {
    ON_TRACK: t("tickets.sla.onTrack", "On Track"),
    AT_RISK: t("tickets.sla.atRisk", "At Risk"),
    BREACHED: t("tickets.sla.breached", "Breached"),
    MET: t("tickets.sla.met", "Met"),
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border shadow-2xs ${badgeStyles[state] ?? "border-border text-muted-foreground"}`}
    >
      <span className={`size-1.5 rounded-full ${dotColors[state] ?? "bg-muted-foreground"}`} aria-hidden="true" />
      <span>{labels[state] ?? state}</span>
    </span>
  );
}
