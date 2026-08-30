import type { TicketStatus } from "@/features/tickets/ticket.types";

/**
 * Single canonical status order across all ticket tables, details, filters, and charts.
 */
export const CANONICAL_STATUS_ORDER: readonly TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
] as const;

/**
 * Canonical visual representation for each ticket status.
 *
 * Distinct roles:
 * - NEW: Incoming fresh ticket (Cyan / Sky) - distinctly active and visible, not neutral/closed
 * - OPEN: Triage / queued (Blue / Info)
 * - IN_PROGRESS: Working (Purple / Progress)
 * - WAITING_CUSTOMER: Pending customer response (Amber / Warning)
 * - ESCALATED: Attention required (Red / Danger)
 * - RESOLVED: Addressed (Green / Success)
 * - CLOSED: Archived / done (Muted Neutral Gray)
 */
export interface StatusThemeConfig {
  badgeVariant: "neutral" | "info" | "progress" | "warning" | "success" | "danger";
  badgeCustomClass?: string;
  chartColor: string;
  dotColor: string;
}

export const CANONICAL_STATUS_THEME: Record<TicketStatus, StatusThemeConfig> = {
  NEW: {
    badgeVariant: "info",
    badgeCustomClass: "border-cyan-500/25 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-500/30",
    chartColor: "#06B6D4", // Cyan-500
    dotColor: "bg-cyan-500",
  },
  OPEN: {
    badgeVariant: "info",
    chartColor: "var(--info)",
    dotColor: "bg-info",
  },
  IN_PROGRESS: {
    badgeVariant: "progress",
    chartColor: "var(--progress)",
    dotColor: "bg-progress",
  },
  WAITING_CUSTOMER: {
    badgeVariant: "warning",
    chartColor: "var(--warning)",
    dotColor: "bg-warning",
  },
  ESCALATED: {
    badgeVariant: "danger",
    chartColor: "var(--danger)",
    dotColor: "bg-danger",
  },
  RESOLVED: {
    badgeVariant: "success",
    chartColor: "var(--success)",
    dotColor: "bg-success",
  },
  CLOSED: {
    badgeVariant: "neutral",
    chartColor: "var(--muted-foreground)",
    dotColor: "bg-muted-foreground",
  },
};

export function getStatusChartColor(status: TicketStatus): string {
  return CANONICAL_STATUS_THEME[status]?.chartColor ?? "var(--chart-1)";
}

export function getStatusDotClass(status: TicketStatus): string {
  return CANONICAL_STATUS_THEME[status]?.dotColor ?? "bg-muted-foreground";
}
