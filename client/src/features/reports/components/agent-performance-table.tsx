import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { AgentReports, AgentReportRow } from "../reports.types";
import { Duration } from "./duration";
import { SectionError } from "./report-primitives";

export function AgentPerformanceTable({
  data,
  isError,
  isLoading,
  onRetry,
}: {
  data: AgentReports | undefined;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  if (isError || !data) return <SectionError onRetry={onRetry} loading={isLoading} />;
  if (data.agents.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("reports.emptyAgents")}</p>;
  }

  return <AgentTable rows={data.agents} nf={nf} t={t} />;
}

function AgentTable({
  rows,
  nf,
  t,
}: {
  rows: AgentReportRow[];
  nf: Intl.NumberFormat;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const numericHeaders = [
    t("reports.agents.assigned"),
    t("reports.agents.resolved"),
    t("reports.agents.open"),
    t("reports.agents.slaMet"),
    t("reports.agents.avgResponse"),
  ];

  return (
    <>
      <div className="hidden md:block">
        <TableContainer>
          <Table className="min-w-[52rem]">
            <colgroup>
              <col className="w-64" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-32" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports.agents.name")}</TableHead>
                {numericHeaders.map((label) => (
                  <TableHead key={label} className="text-end">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.agentId}>
                  <TableCell>
                    <span
                      className="line-clamp-1 break-words font-medium text-foreground"
                      title={row.agentName}
                      dir="auto"
                    >
                      {row.agentName}
                    </span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-foreground">
                    {nf.format(row.assigned)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-foreground">
                    {nf.format(row.resolved)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-foreground">
                    {nf.format(row.open)}
                  </TableCell>
                  <TableCell className="text-end font-medium tabular-nums text-foreground">
                    {row.slaMetPct === null ? "—" : `${nf.format(row.slaMetPct)}%`}
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-muted-foreground">
                    <Duration minutes={row.averageFirstResponseMinutes} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.agentId}
            className="rounded-lg border border-border bg-card p-4 shadow-subtle"
          >
            <p className="font-semibold text-foreground" dir="auto">
              {row.agentName}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t("reports.agents.assigned")}</dt>
                <dd className="tabular-nums font-medium">{nf.format(row.assigned)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t("reports.agents.resolved")}</dt>
                <dd className="tabular-nums font-medium">{nf.format(row.resolved)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t("reports.agents.open")}</dt>
                <dd className="tabular-nums font-medium">{nf.format(row.open)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t("reports.agents.slaMet")}</dt>
                <dd className="tabular-nums font-medium">
                  {row.slaMetPct === null ? "—" : `${nf.format(row.slaMetPct)}%`}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
