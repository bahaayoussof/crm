import { useTranslation } from "react-i18next";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { Role } from "@/features/auth/auth.types";

const roleVariant: Record<Role, NonNullable<BadgeProps["variant"]>> = {
  ADMIN: "info",
  MANAGER: "progress",
  AGENT: "neutral",
  CUSTOMER: "secondary",
};

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useTranslation();
  return (
    <Badge variant={roleVariant[role]} className="uppercase tracking-wide">
      {t(`profile.roles.${role.toLowerCase()}`)}
    </Badge>
  );
}
