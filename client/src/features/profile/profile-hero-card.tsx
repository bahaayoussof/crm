import { CalendarDays, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SelfProfile } from "./profile.types";
import { formatProfileDate } from "./profile-format";
import { ProfileAvatar } from "./profile-avatar";
import { RoleBadge } from "./role-badge";

export function ProfileHeroCard({ profile }: { profile: SelfProfile }) {
  const { t, i18n } = useTranslation();

  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <ProfileAvatar name={profile.name} />
        <div className="min-w-0 space-y-1.5">
          <h2 className="truncate text-lg font-semibold text-foreground" dir="auto">
            {profile.name}
          </h2>
          <div>
            <RoleBadge role={profile.role} />
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate" dir="ltr">
              {profile.email}
            </span>
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {t("profile.joinedOn", { date: formatProfileDate(profile.createdAt, i18n.language) })}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
