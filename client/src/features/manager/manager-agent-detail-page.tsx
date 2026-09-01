import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TicketPriorityText, TicketStatusBadge } from "@/features/tickets/ticket-badges";
import { formatTicketDate, ticketReference } from "@/features/tickets/ticket-format";
import { useManagerAgentDetail } from "./manager-hooks";
import { formatDurationMinutes, formatPercent, formatRating } from "./manager-format";
import type { ManagerAgentDetail, ManagerTicketSummary } from "./manager.types";

export function ManagerAgentDetailPage() {
  const { t } = useTranslation();
  const { agentId } = useParams<{ agentId: string }>();
  const query = useManagerAgentDetail(agentId);

  if (query.isLoading) {
    return (
      <main className="page-container space-y-6" aria-label={t("common.loading")}>
        <div className="h-10 w-56 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="page-container">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center shadow-subtle">
          <p className="text-sm text-muted-foreground">{t("manager.agentDetail.notFound")}</p>
          <Link to="/manager/team" className="mt-4">
            <Button variant="secondary">{t("manager.team.back")}</Button>
          </Link>
        </div>
      </main>
    );
  }

  const data = query.data;

  return (
    <main className="page-container space-y-6">
      <PageHeader
        title={data.agent.name}
        description={data.agent.email}
        breadcrumbs={
          <Link to="/manager/team" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3" />
            {t("manager.team.back")}
          </Link>
        }
        actions={
          <Link to={`/tickets?assignedAgentId=${data.agent.id}`} className="button-link">
            {t("manager.agentDetail.viewTickets", { name: data.agent.name })}
          </Link>
        }
      />

      <Workload workload={data.workload} slaRisk={data.slaRisk} />
      <Performance performance={data.performance} />

      <TicketList
        title={t("manager.agentDetail.slaRiskTickets")}
        emptyLabel={t("manager.agentDetail.noRiskTickets")}
        tickets={data.atRiskTickets}
      />
      <TicketList
        title={t("manager.agentDetail.recentActivity")}
        emptyLabel={t("manager.agentDetail.noRecentActivity")}
        tickets={data.recentTickets}
      />
    </main>
  );
}

function Workload({
  workload,
  slaRisk,
}: {
  workload: ManagerAgentDetail["workload"];
  slaRisk: ManagerAgentDetail["slaRisk"];
}) {
  const { t } = useTranslation();
  const cards: Array<{ key: string; value: number; variant?: "danger" | "warning" }> = [
    { key: "openAssigned", value: workload.openAssigned },
    { key: "inProgress", value: workload.inProgress },
    { key: "waitingCustomer", value: workload.waitingCustomer },
    { key: "escalated", value: workload.escalated, variant: workload.escalated > 0 ? "danger" : undefined },
    { key: "slaBreached", value: slaRisk.breached, variant: slaRisk.breached > 0 ? "danger" : undefined },
    { key: "slaAtRisk", value: slaRisk.atRisk, variant: slaRisk.atRisk > 0 ? "warning" : undefined },
  ];
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("manager.agentDetail.workload")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <MetricCard
            key={card.key}
            label={t(`manager.agentDetail.${card.key}`)}
            value={String(card.value)}
            variant={card.variant}
          />
        ))}
      </div>
    </section>
  );
}

function Performance({ performance }: { performance: ManagerAgentDetail["performance"] }) {
  const { t } = useTranslation();
  const cards = [
    { key: "resolved", value: String(performance.resolvedCount) },
    { key: "slaCompliance", value: formatPercent(performance.slaCompliancePct) },
    { key: "avgFirstResponse", value: formatDurationMinutes(performance.avgFirstResponseMinutes) },
    { key: "avgResolution", value: formatDurationMinutes(performance.avgResolutionMinutes) },
    {
      key: "csat",
      value:
        performance.csat.responseCount > 0
          ? `${formatRating(performance.csat.averageRating)} (${performance.csat.responseCount})`
          : "—",
    },
  ];
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("manager.agentDetail.performance")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <MetricCard key={card.key} label={t(`manager.agentDetail.${card.key}`)} value={card.value} />
        ))}
      </div>
    </section>
  );
}

function TicketList({
  title,
  emptyLabel,
  tickets,
}: {
  title: string;
  emptyLabel: string;
  tickets: ManagerTicketSummary[];
}) {
  const { t, i18n } = useTranslation();
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {tickets.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("manager.priorityWork.colSubject")}</TableHead>
                <TableHead>{t("manager.priorityWork.colStatus")}</TableHead>
                <TableHead>{t("manager.priorityWork.colPriority")}</TableHead>
                <TableHead className="text-end">{t("manager.priorityWork.colUpdated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                    <span className="ms-2 text-xs text-muted-foreground" dir="ltr">
                      {ticketReference(ticket.id)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <TicketPriorityText priority={ticket.priority} />
                  </TableCell>
                  <TableCell className="text-end text-xs text-muted-foreground" dir="ltr">
                    {formatTicketDate(ticket.updatedAt, i18n.language)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </section>
  );
}
