import { type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "@/components/shared/data-table";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import type { Role } from "@/features/auth/auth.types";
import { TaskDeleteConfirm } from "./task-delete-confirm";
import { formatTaskDateTime, isTaskOverdue } from "./task-format";
import { useUpdateTask } from "./task-hooks";
import { CheckIcon, PencilIcon, ReopenIcon, TrashIcon } from "./task-icons";
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

const COLUMN_WIDTHS: Record<string, string> = {
  title: "w-auto",
  status: "w-[120px]",
  assignee: "w-[20%]",
  dueAt: "w-[184px]",
  actions: "w-[132px]",
};

const COLUMN_CLASSES: Record<string, string> = {
  actions: "text-end",
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

  return (
    <DataTable
      surface={false}
      data={tasks}
      columns={columns}
      getRowId={(task) => task.id}
      columnWidths={COLUMN_WIDTHS}
      columnClasses={COLUMN_CLASSES}
      rowClassName="align-top"
      pagination={{
        page,
        pageSize,
        pageCount,
        totalCount,
        onPageChange,
        ariaLabel: t("tasks.pagination"),
      }}
      renderMobileCard={(task) => (
        <div className="p-4">
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
      )}
    />
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
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scope = taskEditScope(task, currentUserId, currentUserRole);
  const update = useUpdateTask(task.id);

  const toggleStatus = async () => {
    try {
      await update.mutateAsync({ status: task.status === "OPEN" ? "DONE" : "OPEN" });
    } catch {
      /* surfaced on the detail/edit page; row stays unchanged */
    }
  };

  const menuItems: ActionMenuItem[] = [
    ...(scope.canEditStatus
      ? [
          {
            key: "status",
            label: task.status === "OPEN" ? t("tasks.markDone") : t("tasks.reopen"),
            icon: task.status === "OPEN" ? <CheckIcon /> : <ReopenIcon />,
            disabled: update.isPending,
            onClick: toggleStatus,
          },
        ]
      : []),
    ...(scope.canEditContent
      ? [
          {
            key: "edit",
            label: t("tasks.editAction"),
            icon: <PencilIcon />,
            onClick: () => navigate(`/tasks/${task.id}/edit`),
          },
        ]
      : []),
    ...(scope.canDelete
      ? [
          {
            key: "delete",
            label: t("tasks.deleteAction"),
            icon: <TrashIcon />,
            destructive: true,
            onClick: () => onOpenConfirm(task.id, variant),
          },
        ]
      : []),
  ];

  return (
    <div className="inline-flex items-center justify-end">
      <ActionMenu
        items={menuItems}
        triggerLabel={t("tasks.columns.actions")}
        externalTriggerRef={triggerRef}
      />
      {scope.canDelete && (
        <TaskDeleteConfirm
          task={task}
          open={openConfirm?.id === task.id && openConfirm.variant === variant}
          onRequestOpen={() => onOpenConfirm(task.id, variant)}
          onRequestClose={onCloseConfirm}
          hideTrigger
          externalTriggerRef={triggerRef}
        />
      )}
    </div>
  );
}
