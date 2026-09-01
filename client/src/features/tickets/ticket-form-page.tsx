import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppSelectField } from "@/components/ui/app-select";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/features/auth/auth-state";
import { useDepartmentOptions, useTeamOptions } from "@/features/organization/organization-hooks";
import { CustomerCombobox } from "./customer-combobox";
import { getTicketError } from "./ticket-error";
import { useAgents, useCategories, useCreateTicket, useTicket, useUpdateTicket } from "./ticket-hooks";
import { ticketFormSchema, type TicketFormValues } from "./ticket.schemas";
import { TICKET_CREATE_CHANNELS } from "./ticket.types";
import { TicketPage, TicketSkeleton, TicketState } from "./ticket-ui";
import {
  TicketFormActions,
  TicketFormError,
  TicketFormField as Field,
  TicketFormSection,
  TicketFormShell,
} from "./ticket-form-shell";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function TicketFormPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const ticket = useTicket(id);
  const categories = useCategories();
  const create = useCreateTicket();
  const update = useUpdateTicket(id);
  const [apiError, setApiError] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";
  const canAssign = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canChangePriority = canAssign || ticket.data?.assignedAgent?.id === user?.id;

  const { control, register, reset, setValue, handleSubmit, formState: { errors, isSubmitting } } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      customerId: "", subject: "", description: "", priority: "MEDIUM", channel: "WEB", categoryId: "", assignedAgentId: "",
      departmentId: "", teamId: "",
    },
  });

  // feature/team-based-manager-scope — Department → Team → Agent routing. ADMIN
  // picks Department + Team explicitly; a MANAGER's team is implicit (the server
  // owns it) and the agent list is server-scoped to their team.
  const departmentId = (useWatch({ control, name: "departmentId" }) as string | undefined) ?? "";
  const teamId = (useWatch({ control, name: "teamId" }) as string | undefined) ?? "";
  const channel = (useWatch({ control, name: "channel" }) as TicketFormValues["channel"] | undefined) ?? "WEB";
  const channelOptions = TICKET_CREATE_CHANNELS.map((value) => ({ value, label: t(`tickets.channel.${value}`) }));
  const channelHint = channel === "WEB" ? null : t(`tickets.channelHint.${channel}`);

  const departments = useDepartmentOptions({ enabled: isAdmin });
  const teams = useTeamOptions(departmentId || undefined, { enabled: isAdmin && Boolean(departmentId) });
  const agents = useAgents(isAdmin ? teamId || undefined : undefined);

  useEffect(() => {
    if (ticket.data) {
      reset({
        customerId: ticket.data.customer.id,
        subject: ticket.data.subject,
        description: ticket.data.description,
        priority: ticket.data.priority,
        categoryId: ticket.data.category?.id ?? "",
        assignedAgentId: ticket.data.assignedAgent?.id ?? "",
        departmentId: ticket.data.department?.id ?? "",
        teamId: ticket.data.team?.id ?? "",
      });
    }
  }, [reset, ticket.data]);

  const priorityOptions = PRIORITIES.map((value) => ({
    value,
    label: t(`tickets.priority.${value}`),
  }));

  const categoryOptions = [
    { value: "", label: t("tickets.selectCategory") },
    ...(categories.data?.map((category) => ({ value: category.id, label: category.name })) ?? []),
  ];

  const departmentOptions = [
    { value: "", label: t("tickets.selectDepartment") },
    ...(departments.data?.map((department) => ({ value: department.id, label: department.name })) ?? []),
  ];

  const teamOptions = useMemo(() => {
    const forDepartment = (teams.data ?? []).filter((team) => team.departmentId === departmentId);
    const current = ticket.data?.team;
    const options = forDepartment.map((team) => ({ value: team.id, label: team.name }));
    if (current && current.id === teamId && !forDepartment.some((team) => team.id === current.id)) {
      options.unshift({ value: current.id, label: current.name });
    }
    return [{ value: "", label: t("tickets.selectTeam") }, ...options];
  }, [teams.data, departmentId, teamId, ticket.data?.team, t]);

  // ADMIN: agents are already team-scoped by the query; still guard against a
  // stale option after a team switch. MANAGER: server returns only own-team agents.
  const scopedAgents = useMemo(() => {
    if (!isAdmin || !teamId) return agents.data ?? [];
    return (agents.data ?? []).filter((agent) => agent.teamId === teamId);
  }, [agents.data, isAdmin, teamId]);

  const agentOptions = [
    { value: "", label: t("tickets.unassigned") },
    ...scopedAgents.map((agent) => ({ value: agent.id, label: agent.name, searchText: agent.email })),
  ];

  const handleDepartmentChange = (next: string) => {
    setValue("departmentId", next, { shouldDirty: true });
    setValue("teamId", "", { shouldDirty: true });
    setValue("assignedAgentId", "", { shouldDirty: true });
  };
  const handleTeamChange = (next: string) => {
    setValue("teamId", next, { shouldDirty: true });
    setValue("assignedAgentId", "", { shouldDirty: true });
  };

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const routing = isAdmin
        ? { departmentId: values.departmentId || null, teamId: values.teamId || null }
        : {};
      const saved = editing
        ? await update.mutateAsync({
            subject: values.subject,
            description: values.description,
            ...(canChangePriority && { priority: values.priority }),
            categoryId: values.categoryId || null,
            ...(canAssign && { assignedAgentId: values.assignedAgentId || null }),
            ...routing,
          })
        : await create.mutateAsync({
            customerId: values.customerId,
            subject: values.subject,
            description: values.description,
            priority: values.priority,
            channel: values.channel,
            categoryId: values.categoryId || null,
            ...(canAssign && { assignedAgentId: values.assignedAgentId || null }),
            ...routing,
          });
      navigate(`/tickets/${saved.id}`, { replace: true });
    } catch (error) {
      setApiError(getTicketError(error, t("tickets.saveError"), t));
    }
  });

  if (editing && ticket.isLoading) return <TicketPage><TicketSkeleton /></TicketPage>;
  if (editing && ticket.isError) return <TicketPage><TicketState>{t("tickets.notFound")}</TicketState></TicketPage>;

  return (
    <TicketPage>
      <div className="space-y-6">
        <PageHeader
          title={editing ? t("tickets.editTitle") : t("tickets.createTitle")}
          description={t("tickets.formDescription")}
        />
        <TicketFormShell onSubmit={submit}>
          {apiError && <TicketFormError>{apiError}</TicketFormError>}
          <TicketFormSection titleId="ticket-details-heading" title={t("tickets.ticketDetails")} bordered={false}>
            {editing ? (
                <div>
                  <span className="block text-sm font-medium text-foreground">{t("tickets.customer")}</span>
                  <p className="mt-2 rounded-md bg-surface-subtle border border-border px-3 py-2 text-foreground">
                    {ticket.data?.customer.name}{" "}
                    <bdi className="text-muted-foreground" dir="ltr">{ticket.data?.customer.email}</bdi>
                  </p>
                </div>
              ) : (
                <Field id="ticket-customer" label={t("tickets.customer")} error={errors.customerId?.message ? t(errors.customerId.message) : undefined}>
                  <Controller
                    control={control}
                    name="customerId"
                    render={({ field }) => (
                      <CustomerCombobox
                        id="ticket-customer"
                        value={field.value}
                        onChange={field.onChange}
                        invalid={Boolean(errors.customerId)}
                        describedBy={errors.customerId ? "ticket-customer-error" : undefined}
                      />
                    )}
                  />
                </Field>
              )}
              {!editing && (
                <div className="space-y-1.5">
                  <Controller
                    name="channel"
                    control={control}
                    render={({ field }) => (
                      <AppSelectField
                        id="ticket-channel"
                        label={t("tickets.channelLabel")}
                        labelClassName="block text-sm font-medium text-foreground"
                        value={field.value}
                        onValueChange={field.onChange}
                        options={channelOptions}
                      />
                    )}
                  />
                  {channelHint && (
                    <p className="text-xs text-muted-foreground" role="status">{channelHint}</p>
                  )}
                </div>
              )}
              <Field id="ticket-subject" label={t("tickets.subject")} error={errors.subject?.message ? t(errors.subject.message) : undefined}>
                <input id="ticket-subject" className="input" aria-invalid={Boolean(errors.subject)} {...register("subject")} />
              </Field>
              <Field id="ticket-description" label={t("tickets.descriptionLabel")} error={errors.description?.message ? t(errors.description.message) : undefined}>
                <textarea id="ticket-description" className="input min-h-36 resize-y" aria-invalid={Boolean(errors.description)} {...register("description")} />
              </Field>
          </TicketFormSection>
          <TicketFormSection
            titleId="ticket-classification-heading"
            title={t("tickets.classification")}
            className="sm:py-7"
            contentClassName="mt-5 grid gap-x-5 gap-y-5 sm:grid-cols-2"
          >
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <AppSelectField
                    id="ticket-priority"
                    label={t("tickets.priorityLabel")}
                    labelClassName="block text-sm font-medium text-foreground"
                    disabled={editing && !canChangePriority}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={priorityOptions}
                  />
                )}
              />
              <Controller
                name="categoryId"
                control={control}
                render={({ field, fieldState }) => (
                  <AppSelectField
                    id="ticket-category"
                    label={t("tickets.category")}
                    labelClassName="block text-sm font-medium text-foreground"
                    value={field.value}
                    onValueChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                    options={categoryOptions}
                  />
                )}
              />
              {isAdmin && (
                <>
                  <Controller
                    name="departmentId"
                    control={control}
                    render={({ field }) => (
                      <AppSelectField
                        id="ticket-department"
                        label={t("tickets.department")}
                        labelClassName="block text-sm font-medium text-foreground"
                        searchable
                        value={field.value ?? ""}
                        onValueChange={handleDepartmentChange}
                        options={departmentOptions}
                        searchPlaceholder={t("common.search")}
                        emptySearchMessage={t("common.noResults")}
                      />
                    )}
                  />
                  <Controller
                    name="teamId"
                    control={control}
                    render={({ field }) => (
                      <AppSelectField
                        id="ticket-team"
                        label={t("tickets.team")}
                        labelClassName="block text-sm font-medium text-foreground"
                        searchable
                        disabled={!departmentId}
                        value={field.value ?? ""}
                        onValueChange={handleTeamChange}
                        options={teamOptions}
                        placeholder={!departmentId ? t("tickets.selectDepartmentFirstForTeam") : undefined}
                        searchPlaceholder={t("common.search")}
                        emptySearchMessage={t("common.noResults")}
                      />
                    )}
                  />
                </>
              )}
              {canAssign && (
                <Controller
                  name="assignedAgentId"
                  control={control}
                  render={({ field }) => (
                    <AppSelectField
                      id="ticket-agent"
                      label={t("tickets.assignedAgent")}
                      labelClassName="block text-sm font-medium text-foreground"
                      searchable
                      disabled={isAdmin && !teamId}
                      searchPlaceholder={t("tickets.searchAssignee")}
                      emptySearchMessage={t("tickets.noAssigneesFound")}
                      placeholder={isAdmin && !teamId ? t("tickets.selectTeamFirstForAgent") : undefined}
                      value={field.value}
                      onValueChange={field.onChange}
                      options={agentOptions}
                    />
                  )}
                />
              )}
          </TicketFormSection>
          <TicketFormActions>
            <Link className="button-secondary" to={editing ? `/tickets/${id}` : "/tickets"}>{t("common.cancel")}</Link>
            <button className="button-primary w-auto" disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : editing ? t("common.save") : t("tickets.create")}
            </button>
          </TicketFormActions>
        </TicketFormShell>
      </div>
    </TicketPage>
  );
}
