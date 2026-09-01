import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DateRangePicker, type DateRange } from "@/components/date-picker/date-range-picker";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-wrap items-center gap-3" aria-label={t("reports.filters.label")}>
      <div
        className="inline-flex min-h-10 max-w-full items-stretch rounded-md border border-border bg-surface-subtle p-1"
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
              "min-w-0 rounded-sm px-2.5 text-xs font-medium text-muted-foreground transition-colors select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:px-3",
              activePreset === days
                ? "bg-surface text-foreground shadow-xs"
                : "hover:bg-surface-hover/70",
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
        className="w-full min-w-0 sm:min-w-56 sm:flex-[1_1_16rem]"
      />

      <div className="w-full min-w-0 sm:w-52 sm:flex-none">
        <AppSelect
          ariaLabel={t("reports.filters.department")}
          searchable
          searchPlaceholder={t("common.search")}
          emptySearchMessage={t("common.noResults")}
          value={departmentId ?? ""}
          onValueChange={(value) => onOrgFilterChange("departmentId", value)}
          options={departmentOptions}
        />
      </div>

      <div className="w-full min-w-0 sm:w-52 sm:flex-none">
        <AppSelect
          ariaLabel={t("reports.filters.branch")}
          searchable
          searchPlaceholder={t("common.search")}
          emptySearchMessage={t("common.noResults")}
          value={branchId ?? ""}
          onValueChange={(value) => onOrgFilterChange("branchId", value)}
          options={branchOptions}
        />
      </div>

      {hasCustomRange && (
        <Button type="button" variant="ghost" className="shrink-0 px-3" onClick={onReset}>
          {t("reports.filters.reset")}
        </Button>
      )}
    </div>
  );
}
