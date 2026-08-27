import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type PaginationState, type Updater } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table/data-table-pagination";
import { formatUserDate } from "./user-format";
import { PencilIcon } from "./user-icons";
import { UserStatusConfirm } from "./user-status-confirm";
import { RoleBadge, StatusBadge, YouBadge } from "./users-ui";
import type { User } from "./user.types";

interface UserTableProps {
  users: User[];
  currentUserId: string;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
}

type ConfirmVariant = "desktop" | "mobile";

interface UserTableMeta {
  currentUserId: string;
  provableLastActiveAdmin: string | null;
  openConfirm: { id: string; variant: ConfirmVariant } | null;
  requestOpenConfirm: (id: string, variant: ConfirmVariant) => void;
  closeConfirm: () => void;
}

const ICON_LINK =
  "inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors " +
  "hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const columnClasses: Record<string, string> = {
  name: "w-[22%]",
  email: "w-auto",
  role: "w-[132px]",
  status: "w-[120px]",
  createdAt: "w-[150px]",
  actions: "w-[112px]",
};

export function UserTable({
  users,
  currentUserId,
  page,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
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
          <span
            className="block min-w-0 max-w-full truncate text-muted-foreground"
            dir="ltr"
            title={getValue<string>()}
          >
            {getValue<string>()}
          </span>
        ),
      },
      {
        id: "role",
        accessorKey: "role",
        header: () => t("users.columns.role"),
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
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
  };

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: page - 1, pageSize }),
    [page, pageSize]
  );
  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (user) => user.id,
    manualPagination: true,
    pageCount,
    state: { pagination },
    meta,
    onPaginationChange: (updater) => handlePaginationChange(updater, pagination, onPageChange),
  });

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <Table className="min-w-[52rem]">
          <colgroup>
            {table.getAllLeafColumns().map((column) => (
              <col key={column.id} className={columnClasses[column.id] ?? ""} />
            ))}
          </colgroup>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={`font-medium ${header.column.id === "actions" ? "text-end" : "text-start"}`}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    className={cell.column.id === "actions" ? "text-end" : ""}
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border-subtle bg-table-background md:hidden">
        {users.map((user) => (
          <li className="p-4" key={user.id}>
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
            <div className="mt-3 flex justify-end">
              <RowActions user={user} meta={meta} variant="mobile" />
            </div>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="border-t border-table-border bg-table-background px-3.5 py-2">
          <DataTablePagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            totalCount={totalCount}
            canPreviousPage={table.getCanPreviousPage()}
            canNextPage={table.getCanNextPage()}
            onPreviousPage={() => table.previousPage()}
            onNextPage={() => table.nextPage()}
            ariaLabel={t("users.pagination")}
          />
        </div>
      )}
    </>
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

  const isSelf = user.id === meta.currentUserId;
  const lockedLastAdmin = meta.provableLastActiveAdmin === user.id;
  const deactivating = user.isActive;
  const disabled = deactivating && (isSelf || lockedLastAdmin);
  const disabledReason = disabled
    ? isSelf
      ? t("users.selfDeactivateBlocked")
      : t("users.lastAdminBlocked")
    : undefined;

  return (
    <div className="inline-flex items-center gap-1.5">
      <Link
        className={ICON_LINK}
        to={`/users/${user.id}/edit`}
        aria-label={t("users.editAction")}
        title={t("users.editAction")}
      >
        <PencilIcon />
      </Link>
      <UserStatusConfirm
        user={user}
        disabled={disabled}
        disabledReason={disabledReason}
        open={meta.openConfirm?.id === user.id && meta.openConfirm.variant === variant}
        onRequestOpen={() => meta.requestOpenConfirm(user.id, variant)}
        onRequestClose={meta.closeConfirm}
      />
    </div>
  );
}

function handlePaginationChange(
  updater: Updater<PaginationState>,
  current: PaginationState,
  onPageChange: (page: number) => void
) {
  const next = typeof updater === "function" ? updater(current) : updater;
  if (next.pageIndex !== current.pageIndex) onPageChange(next.pageIndex + 1);
}
