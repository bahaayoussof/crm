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
import { useAuth } from "@/features/auth/auth-state";
import { AttachmentPanel } from "@/features/attachments/attachment-ui";
import { useCustomerAttachments, useUploadCustomerAttachment } from "@/features/attachments/attachment-hooks";
import { canManageCustomers } from "./customer-permissions";
import { CustomerTickets } from "./customer-tickets";
import { cn } from "@/lib/utils";

const tabs = ["overview", "tickets", "activity", "notes", "attachments"] as const;
type Tab = typeof tabs[number];

export function CustomerDetailPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canManage = Boolean(user && canManageCustomers(user.role));
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
    return (
      <CustomerPage>
        <PageHeader title={t("customers.detailsTitle")} />
        <div className="mt-6">
          <StatePanel action={<Link className="text-primary hover:underline" to="/customers">{t("customers.backToList")}</Link>}>
            {error.status === 404 ? t("customers.notFound") : t("customers.loadError")}
          </StatePanel>
        </div>
      </CustomerPage>
    );
  }

  const profile = customer.data;
  const deleteProfile = async () => {
    if (!window.confirm(t("customers.deleteConfirm"))) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(profile.id);
      navigate("/customers", { replace: true });
    } catch (error) {
      setDeleteError(getLocalizedCustomerError(error, t("customers.deleteError"), t));
    }
  };

  return (
    <CustomerPage>
      <div className="space-y-6">
        <PageHeader
          title={profile.name}
          description={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <bdi dir="ltr">{profile.email}</bdi>
              {profile.phone && (
                <>
                  <span aria-hidden="true">·</span>
                  <bdi dir="ltr">{profile.phone}</bdi>
                </>
              )}
            </span>
          }
          actions={
            canManage ? (
              <>
                <Link className="button-secondary" to={`/customers/${profile.id}/edit`}>
                  {t("common.edit")}
                </Link>
                <button className="button-danger" type="button" disabled={remove.isPending} onClick={deleteProfile}>
                  {t("common.delete")}
                </button>
              </>
            ) : undefined
          }
        />
        {deleteError && (
          <p className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground" role="alert">
            {deleteError}
          </p>
        )}
        <div className="border-b border-border overflow-x-auto">
          <div className="flex min-w-max gap-2" role="tablist" aria-label={t("customers.detailsSections")}>
            {tabs.map((tab) => (
              <button
                id={`customer-tab-${tab}`}
                role="tab"
                key={tab}
                aria-selected={activeTab === tab}
                aria-controls={`customer-panel-${tab}`}
                className={cn(
                  "min-h-10 border-b-2 px-3.5 text-sm font-medium outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-primary/25",
                  activeTab === tab
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground"
                )}
                onClick={() => setParams(tab === "overview" ? {} : { tab })}
              >
                {t(`customers.tabs.${tab}`)}
              </button>
            ))}
          </div>
        </div>
        <section id={`customer-panel-${activeTab}`} role="tabpanel" aria-labelledby={`customer-tab-${activeTab}`} className="outline-none">
          {activeTab === "overview" && <Overview profile={profile} locale={i18n.language} />}
          {activeTab === "tickets" && <CustomerTickets customerId={profile.id} />}
          {activeTab === "activity" && <Activity profile={profile} notes={notes.data ?? []} locale={i18n.language} />}
          {activeTab === "notes" && <Notes customerId={profile.id} canManage={canManage} />}
          {activeTab === "attachments" && <CustomerAttachments customerId={profile.id} canManage={canManage} locale={i18n.language} />}
        </section>
      </div>
    </CustomerPage>
  );
}

function Overview({ profile, locale }: { profile: NonNullable<ReturnType<typeof useCustomer>["data"]>; locale: string }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-x-8 gap-y-7 lg:grid-cols-2">
      <InfoSection title={t("customers.contactInformation")}>
        <Definition label={t("customers.email")} value={profile.email} ltr />
        <Definition label={t("customers.phone")} value={profile.phone ?? t("common.notProvided")} ltr />
        <Definition label={t("customers.customerSince")} value={formatDate(profile.createdAt, locale)} />
      </InfoSection>
      <InfoSection title={t("customers.supportSummary")}>
        <Definition label={t("customers.openTickets")} value={formatNumber(profile.supportSummary.openTicketCount, locale)} />
        <Definition label={t("customers.totalTickets")} value={formatNumber(profile.supportSummary.totalTicketCount, locale)} />
        <Definition label={t("customers.lastInteraction")} value={formatDate(profile.supportSummary.lastInteractionAt, locale)} />
      </InfoSection>
      <PlainSection title={t("customers.recentTickets")}>
        <p className="text-sm text-muted-foreground">{t("customers.noTickets")}</p>
      </PlainSection>
      <PlainSection title={t("customers.recentActivity")}>
        <div className="border-s-2 border-border ps-4">
          <p className="text-sm font-medium text-foreground">{t("customers.customerUpdated")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(profile.updatedAt, locale)}</p>
        </div>
      </PlainSection>
    </div>
  );
}

function Notes({ customerId, canManage }: { customerId: string; canManage: boolean }) {
  const { t, i18n } = useTranslation();
  const notes = useCustomerNotes(customerId);
  const create = useCreateCustomerNote(customerId);
  const [apiError, setApiError] = useState<string | null>(null);
  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<CustomerNoteValues>({ resolver: zodResolver(customerNoteSchema), defaultValues: { body: "" } });
  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await create.mutateAsync(values);
      reset();
    } catch (error) {
      setApiError(getLocalizedCustomerError(error, t("customers.noteError"), t));
    }
  });

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        {notes.isLoading ? (
          <LoadingRows />
        ) : notes.isError ? (
          <StatePanel action={<button className="button-secondary" onClick={() => notes.refetch()}>{t("common.retry")}</button>}>
            {t("customers.notesLoadError")}
          </StatePanel>
        ) : notes.data?.length ? (
          <div className="divide-y divide-border-subtle rounded-xl border border-border bg-surface p-5 shadow-subtle">
            {notes.data.map((note) => (
              <article className="py-4 first:pt-0 last:pb-0" key={note.id}>
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{note.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground" dir="auto">{note.author.name}</span> · {formatDate(note.createdAt, i18n.language)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <StatePanel>{t("customers.noNotes")}</StatePanel>
        )}
      </div>
      {canManage ? (
        <form className="h-fit rounded-xl border border-border bg-surface p-5 shadow-subtle" onSubmit={submit}>
          <h2 className="font-semibold text-foreground">{t("customers.addNote")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("customers.internalNoteHint")}</p>
          {apiError && (
            <p className="mt-3 rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground" role="alert">
              {apiError}
            </p>
          )}
          <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="customer-note-body">{t("customers.noteBody")}</label>
          <textarea
            id="customer-note-body"
            className="input mt-2 min-h-32 resize-y"
            aria-invalid={Boolean(errors.body)}
            aria-describedby={errors.body ? "customer-note-error" : undefined}
            {...register("body")}
          />
          {errors.body && <p id="customer-note-error" className="mt-1.5 text-sm text-danger">{t(errors.body.message ?? "customers.validation.note")}</p>}
          <button className="button-link mt-4 w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? t("common.saving") : t("customers.addNote")}
          </button>
        </form>
      ) : (
        <aside className="h-fit rounded-xl border border-border bg-surface-subtle/50 p-5">
          <h2 className="text-sm font-semibold text-foreground">{t("customers.readOnlyTitle")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("customers.readOnlyNotes")}</p>
        </aside>
      )}
    </div>
  );
}

function Activity({ profile, notes, locale }: { profile: NonNullable<ReturnType<typeof useCustomer>["data"]>; notes: NonNullable<ReturnType<typeof useCustomerNotes>["data"]>; locale: string }) {
  const { t } = useTranslation();
  const events = [
    ...notes.map((note) => ({ id: note.id, label: t("customers.noteAddedBy", { name: note.author.name }), date: note.createdAt })),
    { id: "updated", label: t("customers.customerUpdated"), date: profile.updatedAt },
    { id: "created", label: t("customers.customerCreated"), date: profile.createdAt },
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return (
    <ol className="relative ms-1 max-w-2xl border-s border-border">
      {events.map((event) => (
        <li className="relative pb-6 ps-6 last:pb-0" key={event.id}>
          <span className="absolute -start-1.5 top-1.5 size-3 rounded-full border-2 border-surface bg-primary" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{event.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.date, locale)}</p>
        </li>
      ))}
    </ol>
  );
}

function CustomerAttachments({ customerId, canManage, locale }: { customerId: string; canManage: boolean; locale: string }) {
  const { t } = useTranslation();
  const query = useCustomerAttachments(customerId);
  const upload = useUploadCustomerAttachment(customerId);
  return (
    <AttachmentPanel
      attachments={query.data}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      scope="internal"
      locale={locale}
      canUpload={canManage}
      upload={canManage ? { mutateAsync: (file) => upload.mutateAsync(file), isPending: upload.isPending } : undefined}
      emptyText={t("customers.noAttachments")}
    />
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-subtle">
      <h2 className="border-b border-border px-5 py-3.5 text-sm font-semibold text-foreground">{title}</h2>
      <dl className="divide-y divide-border-subtle px-5">{children}</dl>
    </section>
  );
}

function PlainSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Definition({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-5 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium text-foreground" dir={ltr ? "ltr" : undefined}>{value}</dd>
    </div>
  );
}
