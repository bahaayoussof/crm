import type { AuthUser } from "@/features/auth/auth.types";
import type { ProtectedAudience } from "@/features/auth/auth-routing";
import { canManageQuickReplies } from "@/features/quick-replies/quick-reply-permissions";
import { canViewReports } from "@/features/reports/reports-permissions";
import { canManageUsers } from "@/features/users/user-permissions";
import {
  CustomersNavIcon,
  DashboardNavIcon,
  KnowledgeBaseNavIcon,
  LiveChatNavIcon,
  NewRequestNavIcon,
  ProfileNavIcon,
  QuickRepliesNavIcon,
  ReportsNavIcon,
  SettingsNavIcon,
  TasksNavIcon,
  TicketsNavIcon,
  UsersNavIcon,
  AuditLogsNavIcon,
} from "./nav-icons";
import type { NavItemConfig, NavSectionConfig } from "./sidebar/sidebar-types";

/**
 * Single source of truth for primary navigation, consumed by both the desktop
 * `Sidebar` and the responsive drawer in `AppShell`. Role/permission gating and
 * audience (internal CRM vs. customer portal) selection live here only — the
 * shell components render whatever sections this returns.
 *
 * Frontend gating is presentation only. Backend RBAC and data-ownership scoping
 * remain the authoritative access boundary for every route listed here.
 */
export function getNavigationSections(
  user: AuthUser | null,
  audience: ProtectedAudience,
): NavSectionConfig[] {
  if (audience === "customer") {
    return [
      {
        id: "portal",
        labelKey: "navigation.sections.support",
        label: "Support",
        items: [
          { to: "/portal", key: "portalOverview", icon: DashboardNavIcon, end: true },
          { to: "/portal/tickets", key: "portalRequests", icon: TicketsNavIcon },
          { to: "/portal/live-chat", key: "portalLiveChat", icon: LiveChatNavIcon },
          { to: "/portal/tickets/new", key: "portalNewRequest", icon: NewRequestNavIcon },
          { to: "/portal/knowledge-base", key: "portalKnowledgeBase", icon: KnowledgeBaseNavIcon },
          { to: "/portal/profile", key: "portalProfile", icon: ProfileNavIcon },
        ],
      },
    ];
  }

  // MANAGER gets a focused, operations-first console — Overview / Tickets / Team
  // / Tasks / Reports / Knowledge Base — and nothing else. Customers, Quick
  // Replies, Users, Audit Logs and Settings are intentionally absent from the
  // Manager nav (their routes and backend RBAC are unchanged).
  if (user?.role === "MANAGER") {
    return [
      {
        id: "main",
        labelKey: "navigation.sections.main",
        label: "Main",
        items: [{ to: "/manager", key: "overview", icon: DashboardNavIcon }],
      },
      {
        id: "support",
        labelKey: "navigation.sections.support",
        label: "Support",
        items: [
          { to: "/tickets", key: "tickets", icon: TicketsNavIcon },
          { to: "/manager/team", key: "team", icon: UsersNavIcon },
          { to: "/knowledge-base", key: "knowledgeBase", icon: KnowledgeBaseNavIcon },
          { to: "/tasks", key: "tasks", icon: TasksNavIcon },
        ],
      },
      {
        id: "management",
        labelKey: "navigation.sections.management",
        label: "Management",
        items: [{ to: "/reports", key: "reports", icon: ReportsNavIcon }],
      },
    ];
  }

  const sections: NavSectionConfig[] = [
    {
      id: "main",
      labelKey: "navigation.sections.main",
      label: "Main",
      items: [{ to: "/dashboard", key: "dashboard", icon: DashboardNavIcon }],
    },
    {
      id: "support",
      labelKey: "navigation.sections.support",
      label: "Support",
      items: [
        { to: "/tickets", key: "tickets", icon: TicketsNavIcon },
        { to: "/customers", key: "customers", icon: CustomersNavIcon },
        { to: "/knowledge-base", key: "knowledgeBase", icon: KnowledgeBaseNavIcon },
        { to: "/tasks", key: "tasks", icon: TasksNavIcon },
      ],
    },
  ];

  const managementItems = [
    ...(user && canViewReports(user.role)
      ? [{ to: "/reports", key: "reports", icon: ReportsNavIcon }]
      : []),

    ...(user && canManageQuickReplies(user.role)

      ? [{ to: "/quick-replies", key: "quickReplies", icon: QuickRepliesNavIcon }]
      : []),
    ...(user && canManageUsers(user.role)
      ? [{ to: "/users", key: "users", icon: UsersNavIcon }]
      : []),
    ...(user?.role === "ADMIN"
      ? [{ to: "/audit-logs", key: "auditLogs", icon: AuditLogsNavIcon }, { to: "/settings", key: "settings", icon: SettingsNavIcon }]
      : []),
  ];

  if (managementItems.length > 0) {
    sections.push({
      id: "management",
      labelKey: "navigation.sections.management",
      label: "Management",
      items: managementItems,
    });
  }

  return sections;
}

/** Flatten every section into one item list (both shells render the same set). */
export function getFlatNavItems(sections: NavSectionConfig[]): NavItemConfig[] {
  return sections.flatMap((section) => section.items);
}

/**
 * True when another nav item targets a route nested under `item.to` and the
 * current path is inside that more-specific item. Used to force an exact
 * (`end`) match on the parent so, e.g., `/portal/tickets/new` highlights only
 * "New Request" — never also "My Requests" — while `/portal/tickets/:id` (which
 * has no dedicated nav item) still highlights "My Requests".
 */
export function isNavItemShadowed(
  item: NavItemConfig,
  allItems: NavItemConfig[],
  pathname: string,
): boolean {
  const prefix = (item.to.endsWith("/") ? item.to.slice(0, -1) : item.to) + "/";
  return allItems.some(
    (other) =>
      other.to !== item.to &&
      other.to.startsWith(prefix) &&
      (pathname === other.to || pathname.startsWith(other.to + "/")),
  );
}
