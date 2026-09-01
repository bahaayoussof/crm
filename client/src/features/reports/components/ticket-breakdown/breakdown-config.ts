import type { TFunction } from "i18next";
import type { BreakdownItem, TicketReports } from "../../reports.types";

export type BreakdownDimension = "status" | "priority" | "category" | "channel";

export interface DimensionMeta {
  key: BreakdownDimension;
  labelKey: string;
  searchable: boolean;
  paginated: boolean;
  chartType: "donut" | "bar";
}

export const DIMENSIONS: readonly BreakdownDimension[] = [
  "status",
  "priority",
  "category",
  "channel",
] as const;

export const DIMENSION_CONFIGS: Record<BreakdownDimension, DimensionMeta> = {
  status: {
    key: "status",
    labelKey: "reports.breakdown.status",
    searchable: false,
    paginated: false,
    chartType: "donut",
  },
  priority: {
    key: "priority",
    labelKey: "reports.breakdown.priority",
    searchable: false,
    paginated: false,
    chartType: "bar",
  },
  category: {
    key: "category",
    labelKey: "reports.breakdown.category",
    searchable: true,
    paginated: true,
    chartType: "bar",
  },
  channel: {
    key: "channel",
    labelKey: "reports.breakdown.channel",
    searchable: false,
    paginated: false,
    chartType: "donut",
  },
};

export function normalizeBreakdownItems(
  dimension: BreakdownDimension,
  reports: TicketReports,
  t: TFunction
): BreakdownItem[] {
  const totalCreated = reports.totals.created;

  switch (dimension) {
    case "status": {
      return (reports.byStatus ?? []).map((item) => {
        const created = item.created ?? item.count ?? 0;
        const resolved = item.resolved ?? 0;
        const share = totalCreated > 0 ? Math.round((created / totalCreated) * 100) : 0;
        return {
          key: item.status,
          label: t(`tickets.status.${item.status}`, { defaultValue: item.status }),
          created,
          resolved,
          total: created,
          share,
        };
      });
    }

    case "priority": {
      return (reports.byPriority ?? []).map((item) => {
        const created = item.created ?? 0;
        const resolved = item.resolved ?? 0;
        const share = totalCreated > 0 ? Math.round((created / totalCreated) * 100) : 0;
        return {
          key: item.priority,
          label: t(`tickets.priority.${item.priority}`, { defaultValue: item.priority }),
          created,
          resolved,
          total: created,
          share,
        };
      });
    }

    case "category": {
      return (reports.byCategory ?? []).map((item) => {
        const created = item.created ?? 0;
        const resolved = item.resolved ?? 0;
        const share = totalCreated > 0 ? Math.round((created / totalCreated) * 100) : 0;
        const label = item.categoryName ?? t("reports.uncategorized", { defaultValue: "Uncategorized" });
        return {
          key: item.categoryId ?? "uncategorized",
          label,
          created,
          resolved,
          total: created,
          share,
        };
      });
    }

    case "channel": {
      const channelItems = reports.byChannel ?? [
        { channel: "WEB", created: 0, resolved: 0 },
        { channel: "EMAIL", created: 0, resolved: 0 },
        { channel: "WHATSAPP", created: 0, resolved: 0 },
        { channel: "SMS", created: 0, resolved: 0 },
        { channel: "LIVE_CHAT", created: 0, resolved: 0 },
      ];

      return channelItems.map((item) => {
        const created = item.created ?? 0;
        const resolved = item.resolved ?? 0;
        const share = totalCreated > 0 ? Math.round((created / totalCreated) * 100) : 0;
        return {
          key: item.channel,
          label: t(`tickets.channel.${item.channel}`, { defaultValue: item.channel }),
          created,
          resolved,
          total: created,
          share,
        };
      });
    }

    default:
      return [];
  }
}
