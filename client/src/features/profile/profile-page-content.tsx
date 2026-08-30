import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UseMutationResult } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordDialog } from "@/features/auth/change-password-dialog";
import type { SelfProfile, SelfProfileUpdate } from "./profile.types";
import { EditProfileDialog } from "./edit-profile-dialog";
import { PersonalInformationCard } from "./personal-information-card";
import { ProfileHeroCard } from "./profile-hero-card";
import { SecurityCard } from "./security-card";

interface ProfilePageContentProps {
  profile: SelfProfile | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  updateMutation: UseMutationResult<SelfProfile, unknown, SelfProfileUpdate>;
}

export function ProfilePageContent({
  profile,
  isLoading,
  isError,
  onRetry,
  updateMutation,
}: ProfilePageContentProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const passwordButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="space-y-6">
      <PageHeader title={t("profile.title")} description={t("profile.description")} />

      {isLoading ? (
        <div className="space-y-6" aria-label={t("profile.loading")}>
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-72 animate-pulse rounded-lg bg-muted" />
            <div className="h-72 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      ) : isError || !profile ? (
        <EmptyState
          title={t("profile.loadError")}
          action={
            <button type="button" className="button-secondary" onClick={onRetry}>
              {t("common.retry")}
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <ProfileHeroCard profile={profile} />

          <div className="grid gap-6 lg:grid-cols-2">
            <PersonalInformationCard
              profile={profile}
              onEdit={() => setEditOpen(true)}
              editButtonRef={editButtonRef}
            />
            <SecurityCard
              profile={profile}
              onChangePassword={() => setPasswordOpen(true)}
              changePasswordButtonRef={passwordButtonRef}
            />
          </div>

          <EditProfileDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            profile={profile}
            updateMutation={updateMutation}
            returnFocusRef={editButtonRef}
          />
          <ChangePasswordDialog
            open={passwordOpen}
            onOpenChange={setPasswordOpen}
            returnFocusRef={passwordButtonRef}
          />
        </div>
      )}
    </div>
  );
}
