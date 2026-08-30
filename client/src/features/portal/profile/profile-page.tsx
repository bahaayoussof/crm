import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ChangePasswordDialog } from "@/features/auth/change-password-dialog";
import { PortalPage } from "../portal-ui";
import { EditProfileDialog } from "./edit-profile-dialog";
import { usePortalProfile } from "./profile.queries";

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4 sm:py-3.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground" {...(ltr ? { dir: "ltr" } : {})}>
        {value || "—"}
      </dd>
    </div>
  );
}

export function PortalProfilePage() {
  const { t } = useTranslation();
  const query = usePortalProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const passwordButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <PortalPage>
      <PageHeader title={t("portal.profile.title")} description={t("portal.profile.description")} />

      {query.isLoading ? (
        <div className="mt-6 space-y-6" aria-label={t("portal.profile.loading")}>
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : query.isError || !query.data ? (
        <EmptyState
          className="mt-6"
          title={t("portal.profile.loadError")}
          action={
            <button type="button" className="button-secondary" onClick={() => query.refetch()}>
              {t("common.retry")}
            </button>
          }
        />
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t("portal.profile.personalInformation")}</h2>
              </div>
              <button
                ref={editButtonRef}
                type="button"
                className="button-secondary sm:w-auto"
                onClick={() => setEditOpen(true)}
              >
                {t("portal.profile.editProfile")}
              </button>
            </div>
            <dl className="mt-2 divide-y divide-border">
              <Row label={t("portal.profile.name")} value={query.data.name} />
              <Row label={t("portal.profile.email")} value={query.data.email} ltr />
              <Row label={t("portal.profile.phone")} value={query.data.phone ?? ""} ltr />
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">{t("portal.profile.security")}</h2>
              <button
                ref={passwordButtonRef}
                type="button"
                className="button-secondary sm:w-auto"
                onClick={() => setPasswordOpen(true)}
              >
                {t("portal.profile.changePassword")}
              </button>
            </div>
            <dl className="mt-2 divide-y divide-border">
              <Row label={t("portal.profile.password")} value={"•".repeat(12)} />
            </dl>
          </section>

          <EditProfileDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            profile={query.data}
            returnFocusRef={editButtonRef}
          />
          <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} returnFocusRef={passwordButtonRef} />
        </div>
      )}
    </PortalPage>
  );
}
