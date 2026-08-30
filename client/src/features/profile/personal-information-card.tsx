import { Clock3, Languages, Mail, Pencil, Phone, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SelfProfile } from "./profile.types";
import { currentLanguageLabel, runtimeTimeZone } from "./profile-format";
import { formatPhoneForDisplay } from "@/lib/phone";
import { getProfileEditPermissions } from "./profile-permissions";

function InfoRow({
  icon: Icon,
  label,
  value,
  ltr,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3 gap-y-0.5 py-3 sm:grid-cols-[1.25rem_10rem_1fr] sm:items-center">
      <Icon className="mt-0.5 size-4 text-muted-foreground sm:mt-0" aria-hidden="true" />
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className="col-start-2 text-sm font-medium text-foreground sm:col-start-3"
        {...(ltr ? { dir: "ltr" } : {})}
      >
        {value}
      </dd>
    </div>
  );
}

interface PersonalInformationCardProps {
  profile: SelfProfile;
  onEdit: () => void;
  editButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function PersonalInformationCard({ profile, onEdit, editButtonRef }: PersonalInformationCardProps) {
  const { t, i18n } = useTranslation();
  const editLabel = t("profile.edit");

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{t("profile.personalInformation")}</h2>
        <button
          ref={editButtonRef}
          type="button"
          onClick={onEdit}
          className="button-secondary inline-flex h-8 items-center gap-1.5 px-2.5 text-xs sm:w-auto"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          {editLabel}
        </button>
      </div>

      <dl className="mt-2 divide-y divide-border">
        <InfoRow icon={UserRound} label={t("profile.fullName")} value={profile.name} />
        <InfoRow icon={Mail} label={t("profile.emailAddress")} value={profile.email} ltr />
        <InfoRow
          icon={Phone}
          label={t("profile.phoneNumber")}
          value={formatPhoneForDisplay(profile.phone) ?? t("profile.notProvided")}
          ltr={Boolean(profile.phone)}
        />
        <InfoRow
          icon={Languages}
          label={t("profile.language")}
          value={currentLanguageLabel(i18n.language)}
        />
        <InfoRow icon={Clock3} label={t("profile.timeZone")} value={runtimeTimeZone()} ltr />
      </dl>
    </section>
  );
}
