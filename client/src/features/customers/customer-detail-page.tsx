import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getCustomerError, getLocalizedCustomerError } from "./customer-error";
import { useCreateCustomerNote, useCustomer, useCustomerNotes, useDeleteCustomer } from "./customer-hooks";
import { customerNoteSchema, type CustomerNoteValues } from "./customer.schemas";
import { formatDate, formatNumber } from "./customer-format";
import { CustomerPage, LoadingRows, PageHeader, StatePanel } from "./customer-ui";

const tabs = ["overview", "tickets", "activity", "notes", "attachments"] as const;
type Tab = typeof tabs[number];

export function CustomerDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab");
  const activeTab: Tab = tabs.includes(requestedTab as Tab) ? requestedTab as Tab : "overview";
  const customer = useCustomer(id);
  const notes = useCustomerNotes(id);
  const remove = useDeleteCustomer();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (customer.isLoading) return <CustomerPage><LoadingRows /></CustomerPage>;
  if (customer.isError || !customer.data) {
    const error = getCustomerError(customer.error, t("customers.loadError"));
    return <CustomerPage><PageHeader title={t("customers.detailsTitle")} /><div className="mt-6"><StatePanel action={<Link className="text-primary" to="/customers">{t("customers.backToList")}</Link>}>{error.status === 404 ? t("customers.notFound") : t("customers.loadError")}</StatePanel></div></CustomerPage>;
  }

  const profile = customer.data;
  const deleteProfile = async () => {
    if (!window.confirm(t("customers.deleteConfirm"))) return;
    setDeleteError(null);
    try { await remove.mutateAsync(profile.id); navigate("/customers", { replace: true }); }
    catch (error) { setDeleteError(getLocalizedCustomerError(error, t("customers.deleteError"), t)); }
  };

  return <CustomerPage>
    <PageHeader title={profile.name} description={<><bdi dir="ltr">{profile.email}</bdi>{profile.phone && <> · <bdi dir="ltr">{profile.phone}</bdi></>}</>} actions={<><Link className="button-secondary" to={`/customers/${profile.id}/edit`}>{t("common.edit")}</Link><button className="button-danger" disabled={remove.isPending} onClick={deleteProfile}>{t("common.delete")}</button></>} />
    {deleteError && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{deleteError}</p>}
    <div className="mt-6 overflow-x-auto border-b"><nav className="flex min-w-max gap-6" aria-label={t("customers.detailsSections")}>{tabs.map((tab) => <button className={`border-b-2 px-1 pb-3 text-sm font-medium ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} key={tab} onClick={() => setParams(tab === "overview" ? {} : { tab })}>{t(`customers.tabs.${tab}`)}</button>)}</nav></div>
    <section className="mt-6">
      {activeTab === "overview" && <Overview profile={profile} locale={i18n.language} />}
      {activeTab === "tickets" && <StatePanel>{t("customers.noTickets")}</StatePanel>}
      {activeTab === "activity" && <Activity profile={profile} notes={notes.data ?? []} locale={i18n.language} />}
      {activeTab === "notes" && <Notes customerId={profile.id} />}
      {activeTab === "attachments" && <Attachments attachments={profile.attachments} locale={i18n.language} />}
    </section>
  </CustomerPage>;
}

function Overview({ profile, locale }: { profile: NonNullable<ReturnType<typeof useCustomer>["data"]>; locale: string }) {
  const { t } = useTranslation();
  return <div className="grid gap-5 lg:grid-cols-2">
    <InfoSection title={t("customers.contactInformation")}><Definition label={t("customers.email")} value={profile.email} ltr /><Definition label={t("customers.phone")} value={profile.phone ?? t("common.notProvided")} ltr /><Definition label={t("customers.customerSince")} value={formatDate(profile.createdAt, locale)} /></InfoSection>
    <InfoSection title={t("customers.supportSummary")}><Definition label={t("customers.openTickets")} value={formatNumber(profile.supportSummary.openTicketCount, locale)} /><Definition label={t("customers.totalTickets")} value={formatNumber(profile.supportSummary.totalTicketCount, locale)} /><Definition label={t("customers.lastInteraction")} value={formatDate(profile.supportSummary.lastInteractionAt, locale)} /></InfoSection>
    <InfoSection title={t("customers.recentTickets")}><p className="text-sm text-muted-foreground">{t("customers.noTickets")}</p></InfoSection>
    <InfoSection title={t("customers.recentActivity")}><p className="text-sm text-muted-foreground">{t("customers.profileUpdated", { date: formatDate(profile.updatedAt, locale) })}</p></InfoSection>
  </div>;
}

function Notes({ customerId }: { customerId: string }) {
  const { t, i18n } = useTranslation();
  const notes = useCustomerNotes(customerId);
  const create = useCreateCustomerNote(customerId);
  const [apiError, setApiError] = useState<string | null>(null);
  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<CustomerNoteValues>({ resolver: zodResolver(customerNoteSchema), defaultValues: { body: "" } });
  const submit = handleSubmit(async (values) => { setApiError(null); try { await create.mutateAsync(values); reset(); } catch (error) { setApiError(getLocalizedCustomerError(error, t("customers.noteError"), t)); } });
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <div>{notes.isLoading ? <LoadingRows /> : notes.isError ? <StatePanel action={<button className="text-primary" onClick={() => notes.refetch()}>{t("common.retry")}</button>}>{t("customers.notesLoadError")}</StatePanel> : notes.data?.length ? <div className="space-y-3">{notes.data.map((note) => <article className="rounded-md border bg-white p-4" key={note.id}><p className="whitespace-pre-wrap text-sm">{note.body}</p><p className="mt-3 text-xs text-muted-foreground">{note.author.name} · {formatDate(note.createdAt, i18n.language)}</p></article>)}</div> : <StatePanel>{t("customers.noNotes")}</StatePanel>}</div>
    <form className="h-fit rounded-md border bg-white p-4" onSubmit={submit}><h2 className="font-semibold">{t("customers.addNote")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("customers.internalNoteHint")}</p>{apiError && <p className="mt-3 text-sm text-red-600" role="alert">{apiError}</p>}<label className="mt-4 block text-sm font-medium">{t("customers.noteBody")}<textarea className="input mt-2 min-h-28 resize-y" {...register("body")} />{errors.body && <span className="mt-1 block text-sm text-red-600">{t(errors.body.message ?? "customers.validation.note")}</span>}</label><button className="button-link mt-4 w-full" disabled={isSubmitting} type="submit">{isSubmitting ? t("common.saving") : t("customers.addNote")}</button></form>
  </div>;
}

function Activity({ profile, notes, locale }: { profile: NonNullable<ReturnType<typeof useCustomer>["data"]>; notes: NonNullable<ReturnType<typeof useCustomerNotes>["data"]>; locale: string }) {
  const { t } = useTranslation();
  const events = [
    ...notes.map((note) => ({ id: note.id, label: t("customers.noteAddedBy", { name: note.author.name }), date: note.createdAt })),
    { id: "updated", label: t("customers.customerUpdated"), date: profile.updatedAt },
    { id: "created", label: t("customers.customerCreated"), date: profile.createdAt },
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return <div className="space-y-3">{events.map((event) => <div className="rounded-md border bg-white p-4" key={event.id}><p className="text-sm font-medium">{event.label}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(event.date, locale)}</p></div>)}</div>;
}

function Attachments({ attachments, locale }: { attachments: NonNullable<ReturnType<typeof useCustomer>["data"]>["attachments"]; locale: string }) {
  const { t } = useTranslation();
  return attachments.length ? <div className="divide-y rounded-md border bg-white">{attachments.map((attachment) => <div className="flex items-center justify-between gap-4 p-4" key={attachment.id}><div className="min-w-0"><p className="truncate text-sm font-medium" dir="auto">{attachment.fileName}</p><p className="text-xs text-muted-foreground" dir="ltr">{attachment.mimeType}</p></div><time className="shrink-0 text-xs text-muted-foreground">{formatDate(attachment.createdAt, locale)}</time></div>)}</div> : <StatePanel>{t("customers.noAttachments")}</StatePanel>;
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-md border bg-white p-5"><h2 className="font-semibold">{title}</h2><dl className="mt-4 space-y-3">{children}</dl></section>; }
function Definition({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) { return <div className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-end font-medium" dir={ltr ? "ltr" : undefined}>{value}</dd></div>; }
