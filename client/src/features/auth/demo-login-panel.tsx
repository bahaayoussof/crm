import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth-state";
import { getAuthErrorMessage } from "./auth-error";
import { getRoleHome } from "./auth-routing";
import { DEMO_ACCOUNTS, isDemoMode, type DemoAccount } from "@/lib/demo";

/**
 * "Try the demo" quick-login block. Renders only when the client was built with
 * `VITE_DEMO_MODE=true`; on every other environment this component returns null
 * and is dropped from the bundle.
 *
 * Each button performs a REAL sign-in through the normal `login()` flow (same
 * `/auth/login` endpoint, same JWT, same backend authorization) — it only
 * pre-fills the published demo credentials so trying each role is one click.
 */
export function DemoLoginPanel() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isDemoMode) return null;

  const signInAs = async (account: DemoAccount) => {
    setError(null);
    setPending(account.role);
    try {
      const user = await login({ email: account.email, password: account.password });
      navigate(getRoleHome(user.role), { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err, t));
      setPending(null);
    }
  };

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t("demo.login.title")}</p>
        <span className="rounded-full border border-warning-soft bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-soft-foreground">
          {t("demo.badge")}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("demo.login.description")}</p>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger-subtle bg-danger-subtle/50 p-2.5 text-xs text-danger-foreground">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.role}
            type="button"
            className="button-secondary min-h-9 text-xs"
            disabled={pending !== null}
            onClick={() => signInAs(account)}
          >
            {pending === account.role ? t("auth.signingIn") : t(account.labelKey)}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t("demo.login.credentialHint", { password: DEMO_ACCOUNTS[0].password })}
      </p>
    </div>
  );
}
