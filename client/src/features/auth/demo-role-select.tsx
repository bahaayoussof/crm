import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthField } from "./auth-field";
import { AppSelect } from "@/components/ui/app-select";
import { DEMO_ACCOUNTS, isDemoMode, type DemoAccount, type DemoRole } from "@/lib/demo";

/**
 * Compact "Sign in as" role selector for the public demo login form. Renders
 * only when the client was built with `VITE_DEMO_MODE=true`; on every other
 * environment it returns null and is dropped from the bundle, so no demo
 * credential appears on a normal login page.
 *
 * It is a convenience autofill only. Picking a role resolves the matching
 * account from the shared `DEMO_ACCOUNTS` source of truth and hands it to
 * `onSelect`, which fills the real Email/Password fields. The user still submits
 * through the normal `Sign in` button and the unchanged `/auth/login` flow — no
 * auto-login, no navigation, no faked auth state.
 */
export function DemoRoleSelect({
  onSelect,
  disabled,
}: {
  onSelect: (account: DemoAccount) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [role, setRole] = useState<DemoRole | "">("");

  if (!isDemoMode) return null;

  const options = DEMO_ACCOUNTS.map((account) => ({
    value: account.role,
    label: t(account.roleLabelKey),
  }));

  return (
    <AuthField id="demo-role-select" label={t("demo.login.signInAs")}>
      <AppSelect<DemoRole | "">
        id="demo-role-select"
        value={role}
        onValueChange={(next) => {
          setRole(next);
          const account = DEMO_ACCOUNTS.find((candidate) => candidate.role === next);
          if (account) onSelect(account);
        }}
        options={options}
        placeholder={t("demo.login.selectRolePlaceholder")}
        ariaLabel={t("demo.login.signInAs")}
        disabled={disabled}
      />
    </AuthField>
  );
}
