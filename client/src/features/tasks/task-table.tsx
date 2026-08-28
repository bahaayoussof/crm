import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Updater,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { DataTablePagination } from "@/components/shared/data-table/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Role } from "@/features/auth/auth.types";
import { TaskDeleteConfirm } from "./task-delete-confirm";
import { formatTaskDateTime, isTaskOverdue } from "./task-format";
import { useUpdateTask } from "./task-hooks";
import { CheckIcon, PencilIcon, ReopenIcon, SpinnerIcon } from "./task-icons";
import { taskEditScope } from "./task-permissions";
import { OverdueBadge, TaskStatusBadge } from "./tasks-ui";
import type { Task } from "./task.types";

type ConfirmVariant = "desktop" | "mobile";
interface OpenConfirm {
  id: string;
  variant: ConfirmVariant;
}

interface TaskTableProps {
  tasks: Task[];
  currentUserId: string;
  currentUserRole: Role;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
}

const ICON_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors " +
  "hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const columnClasses: Record<string, string> = {
  title: "w-auto",
  status: "w-[120px]",
  assignee: "w-[20%]",
  dueAt: "w-[184px]",
  actions: "w-[132px]",
};

interface RowActionsShared {
  currentUserId: string;
  currentUserRole: Role;
  openConfirm: OpenConfirm | null;
  onOpenConfirm: (id: string, variant: ConfirmVariant) => void;
  onCloseConfirm: () => void;
}

export function TaskTable({
  tasks,
  currentUserId,
  currentUserRole,
  page,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
}: TaskTableProps) {
  const { t, i18n } = useTranslation();

  // Exactly one delete confirmation open at a time, keyed by row id + which
  // rendered variant (the desktop table row and the mobile card row are both
  // mounted); this keeps a single portalled dialog in the tree.
  const [openConfirm, setOpenConfirm] = useState<OpenConfirm | null>(null);
  const onOpenConfirm = useCallback(
    (id: string, variant: ConfirmVariant) => setOpenConfirm({ id, variant }),
    [],
  );
  const onCloseConfirm = useCallback(() => setOpenConfirm(null), []);
  // Drop stale open state when the visible rows change (filter / pagination).
  useEffect(() => {
    setOpenConfirm(null);
  }, [tasks, page]);

  const shared: RowActionsShared = {
    currentUserId,
    currentUserRole,
    openConfirm,
    onOpenConfirm,
    onCloseConfirm,
  };

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        id: "title",
        accessorKey: "title",
        header: () => t("tasks.columns.title"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              className="block min-w-0 break-words rounded-sm font-semibold text-foreground line-clamp-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              dir="auto"
              title={row.original.title}
              to={`/tasks/${row.original.id}`}
            >
              {row.original.title}
            </Link>
            {row.original.ticket && (
              <Link
                className="mt-0.5 inline-block text-xs text-muted-foreground hover:underline"
                to={`/tickets/${row.original.ticket.id}`}
              >
                {t("tasks.linkedTicket")}: {row.original.ticket.subject}
              </Link>
            )}
          </div>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: () => t("tasks.columns.status"),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <TaskStatusBadge status={row.original.status} />
            {isTaskOverdue(row.original.dueAt, row.original.status) && <OverdueBadge />}
          </div>
        ),
      },
      {
        id: "assignee",
        header: () => t("tasks.columns.assignee"),
        cell: ({ row }) => (
          <span className="block truncate text-sm text-foreground" dir="auto" title={row.original.assignee.name}>
            {row.original.assignee.name}
          </span>
        ),
      },
      {
        id: "dueAt",
        accessorKey: "dueAt",
        header: () => t("tasks.columns.due"),
        cell: ({ getValue }) => {
          const value = getValue<string | null>();
          return value ? (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              <bdi dir="ltr">{formatTaskDateTime(value, i18n.language)}</bdi>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("tasks.noDueDate")}</span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="block text-end">{t("tasks.columns.actions")}</span>,
        cell: ({ row }) => <RowActions task={row.original} variant="desktop" {...shared} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language, t, currentUserId, currentUserRole, openConfirm, onOpenConfirm, onCloseConfirm],
  );

  const pagination = useMemo<PaginationState>(() => ({ pageIndex: page - 1, pageSize }), [page, pageSize]);
  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (task) => task.id,
    manualPagination: true,
    pageCount,
    state: { pagination },
    onPaginationChange: (updater) => handlePaginationChange(updater, pagination, onPageChange),
  });

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
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
              <TableRow key={row.id} className="align-top">
                {row.getVisibleCells().map((cell) => (
                  <TableCell className={cell.column.id === "actions" ? "text-end" : ""} key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y divide-border-subtle bg-table-background md:hidden">
        {tasks.map((task) => (
          <div className="p-4" key={task.id}>
            <div className="flex items-start justify-between gap-3">
              <Link
                className="block min-w-0 break-words rounded-sm font-semibold text-foreground line-clamp-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                dir="auto"
                title={task.title}
                to={`/tasks/${task.id}`}
              >
                {task.title}
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <TaskStatusBadge status={task.status} />
                {isTaskOverdue(task.dueAt, task.status) && <OverdueBadge />}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              <span dir="auto">{task.assignee.name}</span>
              <span className="mx-1">·</span>
              {task.dueAt ? (
                <bdi dir="ltr">{formatTaskDateTime(task.dueAt, i18n.language)}</bdi>
              ) : (
                t("tasks.noDueDate")
              )}
            </p>
            <div className="mt-2.5 flex justify-end">
              <RowActions task={task} variant="mobile" {...shared} />
            </div>
          </div>
        ))}
      </div>

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
            ariaLabel={t("tasks.pagination")}
          />
        </div>
      )}
    </>
  );
}

function RowActions({
  task,
  variant,
  currentUserId,
  currentUserRole,
  openConfirm,
  onOpenConfirm,
  onCloseConfirm,
}: RowActionsShared & { task: Task; variant: ConfirmVariant }) {
  const { t } = useTranslation();
  const scope = taskEditScope(task, currentUserId, currentUserRole);
  const update = useUpdateTask(task.id);

  const toggleStatus = async () => {
    try {
      await update.mutateAsync({ status: task.status === "OPEN" ? "DONE" : "OPEN" });
    } catch {
      /* surfaced on the detail/edit page; row stays unchanged */
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      {scope.canEditStatus && (
        <button
          type="button"
          className={ICON_BUTTON}
          aria-label={task.status === "OPEN" ? t("tasks.markDone") : t("tasks.reopen")}
          title={task.status === "OPEN" ? t("tasks.markDone") : t("tasks.reopen")}
          disabled={update.isPending}
          onClick={toggleStatus}
        >
          {update.isPending ? (
            <SpinnerIcon className="size-4" />
          ) : task.status === "OPEN" ? (
            <CheckIcon />
          ) : (
            <ReopenIcon />
          )}
        </button>
      )}

      {scope.canEditContent && (
        <Link
          className={ICON_BUTTON}
          to={`/tasks/${task.id}/edit`}
          aria-label={t("tasks.editAction")}
          title={t("tasks.editAction")}
        >
          <PencilIcon />
        </Link>
      )}

      {scope.canDelete && (
        <TaskDeleteConfirm
          task={task}
          open={openConfirm?.id === task.id && openConfirm.variant === variant}
          onRequestOpen={() => onOpenConfirm(task.id, variant)}
          onRequestClose={onCloseConfirm}
        />
      )}
    </div>
  );
}

function handlePaginationChange(
  updater: Updater<PaginationState>,
  current: PaginationState,
  onPageChange: (page: number) => void,
) {
  const next = typeof updater === "function" ? updater(current) : updater;
  if (next.pageIndex !== current.pageIndex) onPageChange(next.pageIndex + 1);
}
