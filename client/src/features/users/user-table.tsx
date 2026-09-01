import { type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "@/components/shared/data-table";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { formatUserDate } from "./user-format";
import { PencilIcon, UserRoundCheckIcon, UserRoundXIcon } from "./user-icons";
import { UserStatusConfirm } from "./user-status-confirm";
import { RoleBadge, StatusBadge, YouBadge } from "./users-ui";
import type { User } from "./user.types";

export interface UserTableProps {
  users: User[];
  currentUserId: string;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
  onEditUser?: (user: User) => void;
}

type ConfirmVariant = "desktop" | "mobile";

interface UserTableMeta {
  currentUserId: string;
  provableLastActiveAdmin: string | null;
  openConfirm: { id: string; variant: ConfirmVariant } | null;
  requestOpenConfirm: (id: string, variant: ConfirmVariant) => void;
  closeConfirm: () => void;
  onEditUser?: (user: User) => void;
}

const COLUMN_WIDTHS: Record<string, string> = {
  name: "w-[20%]",
  email: "w-auto",
  role: "w-[120px]",
  department: "w-[170px]",
  status: "w-[110px]",
  createdAt: "w-[140px]",
  actions: "w-[112px]",
};

const COLUMN_CLASSES: Record<string, string> = {
  actions: "text-end",
};

export function UserTable({
  users,
  currentUserId,
  page,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
  onEditUser,
}: UserTableProps) {
  const { t, i18n } = useTranslation();

  const [openConfirm, setOpenConfirm] = useState<{ id: string; variant: ConfirmVariant } | null>(null);
  useEffect(() => {
    setOpenConfirm(null);
  }, [users, page]);
  const requestOpenConfirm = useCallback(
    (id: string, variant: ConfirmVariant) => setOpenConfirm({ id, variant }),
    []
  );
  const closeConfirm = useCallback(() => setOpenConfirm(null), []);

  const provableLastActiveAdmin = useMemo(() => {
    const activeAdmins = users.filter((u) => u.role === "ADMIN" && u.isActive);
    return activeAdmins.length === 1 ? activeAdmins[0].id : null;
  }, [users]);

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: () => t("users.columns.name"),
        cell: ({ row, table }) => (
          <span className="flex min-w-0 items-center gap-1.5">
            <Link
              className="min-w-0 truncate rounded-sm font-semibold text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              dir="auto"
              title={row.original.name}
              to={`/users/${row.original.id}/edit`}
            >
              {row.original.name}
            </Link>
            {row.original.id === (table.options.meta as UserTableMeta).currentUserId && <YouBadge />}
          </span>
        ),
      },
      {
        id: "email",
        accessorKey: "email",
        header: () => t("users.columns.email"),
        cell: ({ getValue }) => (
          <div
            className="min-w-0 max-w-xs truncate text-xs text-muted-foreground text-start"
            dir="ltr"
            title={getValue<string>()}
          >
            {getValue<string>()}
          </div>
        ),
      },
      {
        id: "role",
        accessorKey: "role",
        header: () => t("users.columns.role"),
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "department",
        header: () => t("users.columns.department"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block truncate text-xs text-foreground" dir="auto">
              {row.original.department?.name ?? t("users.departmentNone")}
            </span>
            {row.original.branch && (
              <span className="block truncate text-[11px] text-muted-foreground" dir="auto">
                {row.original.branch.name}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "status",
        accessorKey: "isActive",
        header: () => t("users.columns.status"),
        cell: ({ row }) => <StatusBadge active={row.original.isActive} />,
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: () => t("users.columns.created"),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            <bdi dir="ltr">{formatUserDate(getValue<string>(), i18n.language)}</bdi>
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="block text-end">{t("users.columns.actions")}</span>,
        cell: ({ row, table }) => (
          <RowActions
            user={row.original}
            meta={table.options.meta as UserTableMeta}
            variant="desktop"
          />
        ),
      },
    ],
    [i18n.language, t]
  );

  const meta: UserTableMeta = {
    currentUserId,
    provableLastActiveAdmin,
    openConfirm,
    requestOpenConfirm,
    closeConfirm,
    onEditUser,
  };

  return (
    <DataTable
      surface={false}
      data={users}
      columns={columns}
      getRowId={(user) => user.id}
      meta={meta}
      columnWidths={COLUMN_WIDTHS}
      columnClasses={COLUMN_CLASSES}
      minWidth="min-w-[60rem]"
      pagination={{
        page,
        pageSize,
        pageCount,
        totalCount,
        onPageChange,
        ariaLabel: t("users.pagination"),
      }}
      renderMobileCard={(user) => (
        <div className="p-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              className="min-w-0 truncate rounded-sm font-semibold text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              dir="auto"
              title={user.name}
              to={`/users/${user.id}/edit`}
            >
              {user.name}
            </Link>
            {user.id === currentUserId && <YouBadge />}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground" dir="ltr" title={user.email}>
            {user.email}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <RoleBadge role={user.role} />
            <StatusBadge active={user.isActive} />
            <span className="text-xs text-muted-foreground">
              {t("users.columns.created")}: <bdi dir="ltr">{formatUserDate(user.createdAt, i18n.language)}</bdi>
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground" dir="auto">
            {t("users.columns.department")}: {user.department?.name ?? t("users.departmentNone")}
            {user.branch ? ` · ${user.branch.name}` : ""}
          </p>
          <div className="mt-3 flex justify-end">
            <RowActions user={user} meta={meta} variant="mobile" />
          </div>
        </div>
      )}
    />
  );
}

function RowActions({
  user,
  meta,
  variant,
}: {
  user: User;
  meta: UserTableMeta;
  variant: ConfirmVariant;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isSelf = user.id === meta.currentUserId;
  const lockedLastAdmin = meta.provableLastActiveAdmin === user.id;
  const deactivating = user.isActive;
  const disabled = deactivating && (isSelf || lockedLastAdmin);
  const disabledReason = disabled
    ? isSelf
      ? t("users.selfDeactivateBlocked")
      : t("users.lastAdminBlocked")
    : undefined;

  const menuItems: ActionMenuItem[] = [
    {
      key: "edit",
      label: t("users.editAction"),
      icon: <PencilIcon />,
      onClick: () => {
        if (meta.onEditUser) {
          meta.onEditUser(user);
        } else {
          navigate(`/users/${user.id}/edit`);
        }
      },
    },
    {
      key: "status",
      label: deactivating ? t("users.deactivateAction") : t("users.reactivateAction"),
      icon: deactivating ? <UserRoundXIcon /> : <UserRoundCheckIcon />,
      disabled,
      destructive: deactivating,
      onClick: () => meta.requestOpenConfirm(user.id, variant),
    },
  ];

  return (
    <div className="inline-flex items-center justify-end">
      <ActionMenu
        items={menuItems}
        triggerLabel={t("users.columns.actions")}
        externalTriggerRef={triggerRef}
      />
      <UserStatusConfirm
        user={user}
        disabled={disabled}
        disabledReason={disabledReason}
        open={meta.openConfirm?.id === user.id && meta.openConfirm.variant === variant}
        onRequestOpen={() => meta.requestOpenConfirm(user.id, variant)}
        onRequestClose={meta.closeConfirm}
        hideTrigger
        externalTriggerRef={triggerRef}
      />
    </div>
  );
}
