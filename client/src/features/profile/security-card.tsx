import { CalendarDays, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SelfProfile } from "./profile.types";
import { formatProfileDate } from "./profile-format";

interface SecurityCardProps {
  profile: SelfProfile;
  onChangePassword: () => void;
  changePasswordButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function SecurityCard({ profile, onChangePassword, changePasswordButtonRef }: SecurityCardProps) {
  const { t, i18n } = useTranslation();

  return (
    <section className="flex flex-col rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
          <Lock className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">{t("profile.changePassword")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("profile.security.blurb")}</p>
        </div>
      </div>

      <button
        ref={changePasswordButtonRef}
        type="button"
        onClick={onChangePassword}
        className="button-secondary mt-4 sm:w-auto"
      >
        {t("profile.changePassword")}
      </button>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">{t("profile.lastChanged")}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
          {profile.passwordChangedAt ? (
            <>
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              {formatProfileDate(profile.passwordChangedAt, i18n.language)}
            </>
          ) : (
            t("profile.passwordNeverChanged")
          )}
        </p>
      </div>
    </section>
  );
}
