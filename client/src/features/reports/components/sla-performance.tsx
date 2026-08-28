import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TicketPriorityText } from "../../tickets/ticket-badges";
import type { SlaReports } from "../reports.types";
import { Duration } from "./duration";
import { ReportPanel, SectionError } from "./report-primitives";

type Translate = (key: string, opts?: Record<string, unknown>) => string;

interface SlaTally {
  met: number;
  breached: number;
  pending: number;
  total: number;
  compliancePct: number | null;
}

const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function SlaRing({
  label,
  tally,
  nf,
  t,
}: {
  label: string;
  tally: SlaTally;
  nf: Intl.NumberFormat;
  t: Translate;
}) {
  const pct = tally.compliancePct;
  const dash = pct === null ? 0 : (Math.max(0, Math.min(100, pct)) / 100) * RING_CIRCUMFERENCE;
  const counts = `${t("reports.sla.metShort")} ${nf.format(tally.met)} · ${t("reports.sla.breachedShort")} ${nf.format(tally.breached)} · ${t("reports.sla.pendingShort")} ${nf.format(tally.pending)}`;

  return (
    <div
      className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface-subtle/40 p-4"
      role="img"
      aria-label={`${label}: ${pct === null ? "—" : `${pct}%`}. ${counts}`}
    >
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90">
          <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke="var(--border)" strokeWidth="7" />
          {pct !== null && pct > 0 && (
            <circle
              cx="40"
              cy="40"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${RING_CIRCUMFERENCE}`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-foreground">
            <bdi>{pct === null ? "—" : `${nf.format(pct)}%`}</bdi>
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          <bdi>{counts}</bdi>
        </p>
      </div>
    </div>
  );
}

export function SlaPerformance({
  data,
  isError,
  isLoading,
  onRetry,
}: {
  data: SlaReports | undefined;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  return (
    <ReportPanel>
      {isError || !data ? (
        <SectionError onRetry={onRetry} loading={isLoading} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <SlaRing label={t("reports.sla.firstResponse")} tally={data.firstResponse} nf={nf} t={t} />
            <SlaRing label={t("reports.sla.resolution")} tally={data.resolution} nf={nf} t={t} />
          </div>

          <dl className="flex flex-wrap gap-x-12 gap-y-4 border-t border-border-subtle pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t("reports.sla.avgFirstResponse")}</dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                <Duration minutes={data.averageFirstResponseMinutes} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("reports.sla.avgResolution")}</dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                <Duration minutes={data.averageResolutionMinutes} />
              </dd>
            </div>
          </dl>

          <div className="border-t border-border-subtle pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {t("reports.sla.priorityBreakdown")}
            </h4>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-xs text-muted-foreground">
                    <th className="py-1.5 pe-3 text-start font-medium">{t("tickets.priorityLabel")}</th>
                    <th className="py-1.5 px-3 text-end font-medium">{t("reports.sla.metShort")}</th>
                    <th className="py-1.5 px-3 text-end font-medium">{t("reports.sla.breachedShort")}</th>
                    <th className="py-1.5 ps-3 text-end font-medium">{t("reports.sla.complianceShort")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {data.byPriority.map((row) => (
                    <tr key={row.priority}>
                      <td className="py-1.5 pe-3">
                        <TicketPriorityText priority={row.priority} />
                      </td>
                      <td className="py-1.5 px-3 text-end tabular-nums text-foreground">
                        {nf.format(row.firstResponseMet)}
                      </td>
                      <td className="py-1.5 px-3 text-end tabular-nums text-foreground">
                        {nf.format(row.firstResponseBreached)}
                      </td>
                      <td className="py-1.5 ps-3 text-end font-medium tabular-nums text-foreground">
                        {row.compliancePct === null ? "—" : `${nf.format(row.compliancePct)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ReportPanel>
  );
}
