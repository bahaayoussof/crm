import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { formatTaskDateTime, isTaskOverdue } from "./task-format";
import { getLocalizedTaskError, getTaskError } from "./task-error";
import { useDeleteTask, useTask, useUpdateTask } from "./task-hooks";
import { taskEditScope } from "./task-permissions";
import { LoadingRows, OverdueBadge, PageHeader, StatePanel, TaskStatusBadge, TasksPage } from "./tasks-ui";

export function TaskDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const task = useTask(id);
  const update = useUpdateTask(id);
  const remove = useDeleteTask();
  const [error, setError] = useState<string | null>(null);

  if (task.isLoading || !user) {
    return (
      <TasksPage>
        <LoadingRows />
      </TasksPage>
    );
  }
  if (task.isError || !task.data) {
    const detail = getTaskError(task.error, t("tasks.loadError"));
    return (
      <TasksPage>
        <StatePanel action={<Link className="button-secondary" to="/tasks">{t("tasks.backToList")}</Link>}>
          {detail.status === 404
            ? t("tasks.notFound")
            : getLocalizedTaskError(task.error, t("tasks.loadError"), t)}
        </StatePanel>
      </TasksPage>
    );
  }

  const data = task.data;
  const scope = taskEditScope(data, user.id, user.role);
  const overdue = isTaskOverdue(data.dueAt, data.status);

  const toggleStatus = async () => {
    setError(null);
    try {
      await update.mutateAsync({ status: data.status === "OPEN" ? "DONE" : "OPEN" });
    } catch (mutationError) {
      setError(getLocalizedTaskError(mutationError, t("tasks.saveError"), t));
    }
  };

  const onDelete = async () => {
    setError(null);
    try {
      await remove.mutateAsync(data.id);
      navigate("/tasks", { replace: true });
    } catch (mutationError) {
      setError(getLocalizedTaskError(mutationError, t("tasks.deleteError"), t));
    }
  };

  return (
    <TasksPage>
      <div className="space-y-6">
        <PageHeader
          title={data.title}
          description={
            <span className="inline-flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={data.status} />
              {overdue && <OverdueBadge />}
            </span>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link className="button-secondary" to="/tasks">
                {t("tasks.backToList")}
              </Link>
              {scope.canEditStatus && (
                <button className="button-secondary" onClick={toggleStatus} disabled={update.isPending}>
                  {data.status === "OPEN" ? t("tasks.markDone") : t("tasks.reopen")}
                </button>
              )}
              {scope.canEditContent && (
                <Link className="button-link" to={`/tasks/${data.id}/edit`}>
                  {t("tasks.editAction")}
                </Link>
              )}
            </div>
          }
        />

        {error && (
          <p className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground" role="alert">
            {error}
          </p>
        )}

        <div className="max-w-3xl space-y-6 rounded-xl border border-border bg-surface p-5 shadow-subtle sm:p-6">
          <section>
            <h2 className="text-sm font-medium text-foreground">{t("tasks.fieldDescription")}</h2>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-muted-foreground" dir="auto">
              {data.description || t("tasks.noDescription")}
            </p>
          </section>

          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label={t("tasks.fieldAssignee")}>{data.assignee.name}</Detail>
            <Detail label={t("tasks.creator")}>{data.creator.name}</Detail>
            <Detail label={t("tasks.fieldDueAt")}>
              {data.dueAt ? (
                <bdi dir="ltr">{formatTaskDateTime(data.dueAt, i18n.language)}</bdi>
              ) : (
                t("tasks.noDueDate")
              )}
            </Detail>
            <Detail label={t("tasks.created")}>
              <bdi dir="ltr">{formatTaskDateTime(data.createdAt, i18n.language)}</bdi>
            </Detail>
            {data.ticket && (
              <Detail label={t("tasks.linkedTicket")}>
                <Link className="font-medium text-foreground hover:underline" to={`/tickets/${data.ticket.id}`}>
                  {data.ticket.subject}
                </Link>
              </Detail>
            )}
          </dl>

          {scope.canDelete && (
            <div className="border-t border-border pt-4">
              <button
                className="button-danger w-auto"
                onClick={onDelete}
                disabled={remove.isPending}
              >
                {remove.isPending ? t("tasks.deleting") : t("tasks.deleteAction")}
              </button>
            </div>
          )}
        </div>
      </div>
    </TasksPage>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground" dir="auto">
        {children}
      </dd>
    </div>
  );
}
