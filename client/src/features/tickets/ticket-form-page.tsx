import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { CustomerCombobox } from "./customer-combobox";
import { getTicketError } from "./ticket-error";
import { useAgents, useCategories, useCreateTicket, useTicket, useUpdateTicket } from "./ticket-hooks";
import { ticketFormSchema, type TicketFormValues } from "./ticket.schemas";
import { TicketPage, TicketPageHeader, TicketSkeleton, TicketState } from "./ticket-ui";

export function TicketFormPage() {
  const { t } = useTranslation(); const { id = "" } = useParams(); const editing = Boolean(id); const { user } = useAuth(); const navigate = useNavigate();
  const ticket = useTicket(id); const categories = useCategories(); const agents = useAgents(); const create = useCreateTicket(); const update = useUpdateTicket(id);
  const [apiError, setApiError] = useState<string | null>(null); const canAssign = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canChangePriority = canAssign || ticket.data?.assignedAgent?.id === user?.id;
  const { control, register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<TicketFormValues>({ resolver: zodResolver(ticketFormSchema), defaultValues: { customerId: "", subject: "", description: "", priority: "MEDIUM", categoryId: "", assignedAgentId: "" } });
  useEffect(() => { if (ticket.data) reset({ customerId: ticket.data.customer.id, subject: ticket.data.subject, description: ticket.data.description, priority: ticket.data.priority, categoryId: ticket.data.category?.id ?? "", assignedAgentId: ticket.data.assignedAgent?.id ?? "" }); }, [reset, ticket.data]);
  const submit = handleSubmit(async (values) => { setApiError(null); try {
    const saved = editing ? await update.mutateAsync({ subject: values.subject, description: values.description, ...(canChangePriority && { priority: values.priority }), categoryId: values.categoryId || null, ...(canAssign && { assignedAgentId: values.assignedAgentId || null }) }) : await create.mutateAsync({ customerId: values.customerId, subject: values.subject, description: values.description, priority: values.priority, categoryId: values.categoryId || null, ...(canAssign && { assignedAgentId: values.assignedAgentId || null }) });
    navigate(`/tickets/${saved.id}`, { replace: true });
  } catch (error) { setApiError(getTicketError(error, t("tickets.saveError"), t)); } });
  if (editing && ticket.isLoading) return <TicketPage><TicketSkeleton /></TicketPage>;
  if (editing && ticket.isError) return <TicketPage><TicketState>{t("tickets.notFound")}</TicketState></TicketPage>;
  return <TicketPage><TicketPageHeader title={editing ? t("tickets.editTitle") : t("tickets.createTitle")} description={t("tickets.formDescription")} />
    <form className="mt-6 max-w-3xl overflow-visible rounded-md border bg-white" onSubmit={submit} noValidate>
      {apiError && <p className="mx-5 mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-6" role="alert">{apiError}</p>}
      <section className="px-5 py-6 sm:px-6" aria-labelledby="ticket-details-heading">
        <h2 id="ticket-details-heading" className="text-base font-semibold">{t("tickets.ticketDetails")}</h2>
        <div className="mt-5 space-y-5">
        {editing ? <div><span className="block text-sm font-medium">{t("tickets.customer")}</span><p className="mt-2 rounded-md bg-muted px-3 py-2">{ticket.data?.customer.name} <bdi className="text-muted-foreground" dir="ltr">{ticket.data?.customer.email}</bdi></p></div> : <>
          <Field id="ticket-customer" label={t("tickets.customer")} error={errors.customerId?.message ? t(errors.customerId.message) : undefined}>
            <Controller control={control} name="customerId" render={({ field }) => <CustomerCombobox id="ticket-customer" value={field.value} onChange={field.onChange} invalid={Boolean(errors.customerId)} describedBy={errors.customerId ? "ticket-customer-error" : undefined} />} />
          </Field>
        </>}
        <Field id="ticket-subject" label={t("tickets.subject")} error={errors.subject?.message ? t(errors.subject.message) : undefined}><input id="ticket-subject" className="input" aria-invalid={Boolean(errors.subject)} {...register("subject")} /></Field>
        <Field id="ticket-description" label={t("tickets.descriptionLabel")} error={errors.description?.message ? t(errors.description.message) : undefined}><textarea id="ticket-description" className="input min-h-36 resize-y" aria-invalid={Boolean(errors.description)} {...register("description")} /></Field>
        </div>
      </section>
      <section className="border-t px-5 py-6 sm:px-6 sm:py-7" aria-labelledby="ticket-classification-heading">
        <h2 id="ticket-classification-heading" className="text-base font-semibold">{t("tickets.classification")}</h2>
        <div className="mt-5 grid gap-x-5 gap-y-5 sm:grid-cols-2">
        <Field id="ticket-priority" label={t("tickets.priorityLabel")}><select id="ticket-priority" className="input" disabled={editing && !canChangePriority} {...register("priority")}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option value={value} key={value}>{t(`tickets.priority.${value}`)}</option>)}</select></Field>
        <Field id="ticket-category" label={t("tickets.category")} error={errors.categoryId?.message ? t(errors.categoryId.message) : undefined}><select id="ticket-category" className="input" aria-invalid={Boolean(errors.categoryId)} {...register("categoryId")}><option value="">{t("tickets.selectCategory")}</option>{categories.data?.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></Field>
        {canAssign && <Field id="ticket-agent" label={t("tickets.assignedAgent")}><select id="ticket-agent" className="input" {...register("assignedAgentId")}><option value="">{t("tickets.unassigned")}</option>{agents.data?.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></Field>}
        </div>
      </section>
      <div className="flex flex-wrap justify-end gap-3 border-t bg-muted/35 px-5 py-4 sm:px-6"><Link className="button-secondary" to={editing ? `/tickets/${id}` : "/tickets"}>{t("common.cancel")}</Link><button className="button-primary w-auto" disabled={isSubmitting}>{isSubmitting ? t("common.saving") : editing ? t("common.save") : t("tickets.create")}</button></div>
    </form>
  </TicketPage>;
}
function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) { return <div><label className="block text-sm font-medium" htmlFor={id}>{label}</label><div className="mt-2">{children}</div>{error && <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">{error}</p>}</div>; }
