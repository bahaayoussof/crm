import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth-state";
import { getAuthErrorMessage } from "./auth-error";
import { getRoleHome } from "./auth-routing";
import { Badge } from "@/components/ui/badge";
import { DEMO_ACCOUNTS, isDemoMode, type DemoAccount } from "@/lib/demo";

/**
 * Demo-accounts card for the login page. Renders only when the client was built
 * with `VITE_DEMO_MODE=true`; on every other environment this component returns
 * null and is dropped from the bundle — no demo credential appears anywhere on a
 * normal login page.
 *
 * One card, four compact role rows, one shared-password section. Each "Use
 * account" button performs a REAL sign-in through the normal `login()` flow
 * (same `/auth/login` endpoint, same JWT, same backend authorization, same role
 * redirect) — it only pre-fills the published demo credentials.
 */
export function DemoLoginPanel() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isDemoMode) return null;

  const signInAs = async (account: DemoAccount) => {
    if (pending) return; // guard against duplicate submissions while one is in flight
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

  const sharedPassword = DEMO_ACCOUNTS[0].password;

  return (
    <section
      className="mt-6 rounded-lg border border-border bg-surface-secondary/40 p-4"
      aria-labelledby="demo-accounts-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="demo-accounts-heading" className="text-sm font-semibold text-foreground">
          {t("demo.login.title")}
        </h2>
        <Badge variant="warning" size="sm">
          {t("demo.badge")}
        </Badge>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("demo.login.description")}</p>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-danger-subtle bg-danger-subtle/50 p-2.5 text-xs text-danger-foreground"
        >
          {error}
        </p>
      )}

      <ul className="mt-3 divide-y divide-border/70">
        {DEMO_ACCOUNTS.map((account) => {
          const roleLabel = t(account.roleLabelKey);
          const busy = pending === account.role;
          return (
            <li key={account.role} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{roleLabel}</p>
                <p
                  dir="ltr"
                  title={account.email}
                  className="truncate text-start text-[11px] text-muted-foreground"
                >
                  {account.email}
                </p>
              </div>
              <button
                type="button"
                className="button-secondary min-h-8 shrink-0 px-3 py-1 text-xs"
                aria-label={t("demo.login.useAccountFor", { role: roleLabel })}
                aria-busy={busy}
                disabled={pending !== null}
                onClick={() => signInAs(account)}
              >
                {busy ? t("auth.signingIn") : t("demo.login.useAccount")}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 border-t border-border/70 pt-3">
        <p className="text-[11px] font-medium text-muted-foreground">
          {t("demo.login.sharedPasswordLabel")}
        </p>
        <p dir="ltr" className="mt-0.5 text-start font-mono text-xs text-foreground">
          {sharedPassword}
        </p>
      </div>
    </section>
  );
}
