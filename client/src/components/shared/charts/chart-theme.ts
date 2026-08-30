import type { TicketPriority, TicketStatus } from "@/features/tickets/ticket.types";

export {
  CANONICAL_STATUS_ORDER,
  CANONICAL_STATUS_THEME,
  getStatusChartColor,
} from "@/features/tickets/ticket-status-theme";

/**
 * Standard priority order for charts.
 */
export const CANONICAL_PRIORITY_ORDER: readonly TicketPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const;

/**
 * Semantic CSS variable mappings matching ticket badges and app alerts.
 */
export const STATUS_CHART_COLORS: Record<TicketStatus, string> = {
  NEW: "#06B6D4",
  OPEN: "var(--info)",
  IN_PROGRESS: "var(--progress)",
  WAITING_CUSTOMER: "var(--warning)",
  ESCALATED: "var(--danger)",
  RESOLVED: "var(--success)",
  CLOSED: "var(--muted-foreground)",
};

export type SlaCategory = "ON_TRACK" | "AT_RISK" | "BREACHED";

export const SLA_CHART_COLORS: Record<SlaCategory, string> = {
  ON_TRACK: "var(--success)",
  AT_RISK: "var(--warning)",
  BREACHED: "var(--danger)",
};

export const PRIORITY_CHART_COLORS: Record<TicketPriority, string> = {
  LOW: "var(--info)",
  MEDIUM: "var(--chart-1)",
  HIGH: "var(--warning)",
  URGENT: "var(--danger)",
};

export const SERIES_CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const CHART_THEME_TOKENS = {
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  tooltip: "var(--chart-tooltip)",
  tooltipBorder: "var(--chart-tooltip-border)",
  tooltipForeground: "var(--chart-tooltip-foreground)",
} as const;

export function getSlaChartColor(state: SlaCategory): string {
  return SLA_CHART_COLORS[state] ?? "var(--chart-1)";
}

export function getPriorityChartColor(priority: TicketPriority): string {
  return PRIORITY_CHART_COLORS[priority] ?? "var(--chart-1)";
}
