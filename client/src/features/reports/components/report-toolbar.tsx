import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DateRangePicker, type DateRange } from "@/components/date-picker/date-range-picker";
import { AppSelect } from "@/components/ui/app-select";

interface OrgOption {
  value: string;
  label: string;
}

interface ReportToolbarProps {
  presets: readonly number[];
  activePreset: number | null;
  onPreset: (days: number) => void;
  rangeValue: DateRange;
  onRangeChange: (next: DateRange) => void;
  range: { from?: string; to?: string };
  hasCustomRange: boolean;
  onReset: () => void;
  departmentId?: string;
  branchId?: string;
  departmentOptions: OrgOption[];
  branchOptions: OrgOption[];
  onOrgFilterChange: (key: "departmentId" | "branchId", value: string) => void;
}

export function ReportToolbar({
  presets,
  activePreset,
  onPreset,
  rangeValue,
  onRangeChange,
  range,
  hasCustomRange,
  onReset,
  departmentId,
  branchId,
  departmentOptions,
  branchOptions,
  onOrgFilterChange,
}: ReportToolbarProps) {
  const { t } = useTranslation();
  const rangeLabel = `${t("reports.filters.from")} – ${t("reports.filters.to")}`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={t("reports.filters.label")}>
      <div
        className="inline-flex rounded-md border border-border bg-surface-subtle p-0.5"
        role="group"
        aria-label={t("reports.filters.presetLabel")}
      >
        {presets.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={activePreset === days}
            onClick={() => onPreset(days)}
            className={cn(
              "min-h-7 rounded-[5px] px-2.5 text-xs font-medium transition-colors select-none",
              activePreset === days
                ? "bg-card text-foreground shadow-subtle"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("reports.filters.lastDays", { count: days })}
          </button>
        ))}
      </div>

      <DateRangePicker
        ariaLabel={rangeLabel}
        value={rangeValue}
        onChange={onRangeChange}
        maxDate={new Date()}
        className="w-60"
        triggerClassName="h-8 min-h-8 text-xs"
      />

      <div className="w-44">
        <AppSelect
          ariaLabel={t("reports.filters.department")}
          searchable
          searchPlaceholder={t("common.search")}
          emptySearchMessage={t("common.noResults")}
          value={departmentId ?? ""}
          onValueChange={(value) => onOrgFilterChange("departmentId", value)}
          options={departmentOptions}
          triggerClassName="h-8 min-h-8 text-xs"
        />
      </div>

      <div className="w-44">
        <AppSelect
          ariaLabel={t("reports.filters.branch")}
          searchable
          searchPlaceholder={t("common.search")}
          emptySearchMessage={t("common.noResults")}
          value={branchId ?? ""}
          onValueChange={(value) => onOrgFilterChange("branchId", value)}
          options={branchOptions}
          triggerClassName="h-8 min-h-8 text-xs"
        />
      </div>

      {hasCustomRange && (
        <button type="button" className="button-ghost min-h-8 px-2 text-xs" onClick={onReset}>
          {t("reports.filters.reset")}
        </button>
      )}

      <span
        className="ms-auto text-xs text-muted-foreground/80 tabular-nums"
        dir="ltr"
      >
        {range.from ? range.from.slice(0, 10) : "—"} → {range.to ? range.to.slice(0, 10) : "—"}
        <span className="mx-1.5 text-muted-foreground/40" aria-hidden="true">·</span>
        {t("reports.filters.timezone")}
      </span>
    </div>
  );
}
