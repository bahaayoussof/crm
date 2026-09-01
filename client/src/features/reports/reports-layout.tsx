import { useMemo } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/page-header";
import { useBranchOptions, useDepartmentOptions } from "@/features/organization/organization-hooks";
import type { DateRange } from "@/components/date-picker/date-range-picker";
import { ReportToolbar } from "./components/report-toolbar";
import { ReportsTabs } from "./components/reports-tabs";
import { useReportsRangeParams } from "./hooks/use-reports-range-params";

const PRESETS = [7, 30, 90] as const;

function toUtcMidnightIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

export function ReportsLayout() {
  const { t } = useTranslation();
  const { rangeParams, setRangeParams, resetRangeParams } = useReportsRangeParams();

  const departments = useDepartmentOptions();
  const branches = useBranchOptions();

  const departmentOptions = useMemo(
    () => [
      { value: "", label: t("reports.filters.allDepartments") },
      ...(departments.data?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [departments.data, t]
  );

  const branchOptions = useMemo(
    () => [
      { value: "", label: t("reports.filters.allBranches") },
      ...(branches.data?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [branches.data, t]
  );

  const activePreset = useMemo(() => {
    if (!rangeParams.from || !rangeParams.to) return 30;
    const days = Math.round((Date.parse(rangeParams.to) - Date.parse(rangeParams.from)) / 86_400_000);
    return PRESETS.includes(days as (typeof PRESETS)[number]) ? days : null;
  }, [rangeParams.from, rangeParams.to]);

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    setRangeParams({ from: from.toISOString(), to: to.toISOString() });
  };

  const rangeValue = useMemo<DateRange>(
    () => ({
      from: rangeParams.from ? new Date(rangeParams.from) : undefined,
      to: rangeParams.to ? new Date(rangeParams.to) : undefined,
    }),
    [rangeParams.from, rangeParams.to]
  );

  const setRange = (next: DateRange) => {
    setRangeParams({
      from: next.from ? toUtcMidnightIso(next.from) : "",
      to: next.to ? toUtcMidnightIso(next.to) : "",
    });
  };

  const onOrgFilterChange = (key: "departmentId" | "branchId", value: string) => {
    setRangeParams({ [key]: value });
  };

  const hasCustomRange = Boolean(
    rangeParams.from || rangeParams.to || rangeParams.departmentId || rangeParams.branchId
  );

  return (
    <div className="space-y-6 page-container">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
      />

      <ReportsTabs />

      <ReportToolbar
        presets={PRESETS}
        activePreset={activePreset}
        onPreset={applyPreset}
        rangeValue={rangeValue}
        onRangeChange={setRange}
        hasCustomRange={hasCustomRange}
        onReset={resetRangeParams}
        departmentId={rangeParams.departmentId}
        branchId={rangeParams.branchId}
        departmentOptions={departmentOptions}
        branchOptions={branchOptions}
        onOrgFilterChange={onOrgFilterChange}
      />

      <main className="space-y-6">
        <Outlet />
      </main>
    </div>
  );
}
