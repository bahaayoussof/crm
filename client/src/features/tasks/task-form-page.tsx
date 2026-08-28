import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppSelect } from "@/components/ui/app-select";
import { DatePicker } from "@/components/date-picker/date-picker";
import { useAuth } from "@/features/auth/auth-state";
import { useAgents } from "@/features/tickets/ticket-hooks";
import { localInputToIso, type TaskCreatePayload, type TaskUpdatePayload } from "./task-api";
import { getLocalizedTaskError, getTaskError } from "./task-error";
import { useCreateTask, useTask, useUpdateTask } from "./task-hooks";
import { canAssignTasks, taskEditScope } from "./task-permissions";
import { taskFormSchema, type TaskFormValues } from "./task.schemas";
import { LoadingRows, PageHeader, StatePanel, TasksPage } from "./tasks-ui";

const EMPTY: TaskFormValues = { title: "", description: "", dueAt: "", status: "OPEN", assigneeId: "" };

export function TaskFormPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const isEditing = Boolean(id);
  const { user } = useAuth();
  const task = useTask(id);
  const agents = useAgents();
  const create = useCreateTask();
  const update = useUpdateTask(id);
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    reset,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (isEditing && task.data) {
      reset({
        title: task.data.title,
        description: task.data.description ?? "",
        dueAt: task.data.dueAt ?? "",
        status: task.data.status,
        assigneeId: task.data.assigneeId,
      });
    }
  }, [isEditing, task.data, reset]);

  const scope = useMemo(() => {
    if (isEditing && task.data && user) return taskEditScope(task.data, user.id, user.role);
    return {
      canEditContent: true,
      canEditStatus: isEditing,
      canReassign: Boolean(user && canAssignTasks(user.role)),
      canDelete: false,
    };
  }, [isEditing, task.data, user]);

  const assigneeOptions = [
    { value: "", label: t("tasks.assigneeSelf") },
    ...(agents.data?.map((agent) => ({ value: agent.id, label: agent.name, searchText: agent.email })) ?? []),
  ];
  const statusOptions = (["OPEN", "DONE"] as const).map((value) => ({
    value,
    label: t(`tasks.status.${value}`),
  }));

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      if (isEditing) {
        await update.mutateAsync(buildUpdatePayload(values, scope));
      } else {
        await create.mutateAsync(buildCreatePayload(values));
      }
      navigate(isEditing ? `/tasks/${id}` : "/tasks", { replace: true });
    } catch (error) {
      setApiError(getLocalizedTaskError(error, t("tasks.saveError"), t));
    }
  });

  if (isEditing && task.isLoading) {
    return (
      <TasksPage>
        <LoadingRows />
      </TasksPage>
    );
  }
  if (isEditing && task.isError) {
    const error = getTaskError(task.error, t("tasks.loadError"));
    return (
      <TasksPage>
        <StatePanel>
          {error.status === 404
            ? t("tasks.notFound")
            : getLocalizedTaskError(task.error, t("tasks.loadError"), t)}
        </StatePanel>
      </TasksPage>
    );
  }

  const pending = isSubmitting || create.isPending || update.isPending;
  const contentDisabled = !scope.canEditContent;

  return (
    <TasksPage>
      <div className="space-y-6">
        <PageHeader
          title={isEditing ? t("tasks.editTitle") : t("tasks.createTitle")}
          description={t("tasks.formDescription")}
        />
        <form
          className="max-w-3xl rounded-xl border border-border bg-surface shadow-subtle"
          onSubmit={submit}
          noValidate
        >
          <div className="space-y-5 p-5 sm:p-6">
            {apiError && (
              <p
                className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground"
                role="alert"
              >
                {apiError}
              </p>
            )}

            {contentDisabled && (
              <p className="rounded-md border border-border bg-surface-subtle/60 p-3 text-xs text-muted-foreground">
                {t("tasks.assigneeOnlyHint")}
              </p>
            )}

            <Field
              id="task-title"
              label={t("tasks.fieldTitle")}
              required
              error={errors.title?.message ? t(errors.title.message) : undefined}
            >
              <input
                id="task-title"
                className="input"
                dir="auto"
                disabled={contentDisabled}
                aria-invalid={Boolean(errors.title)}
                {...register("title")}
              />
            </Field>

            <Field
              id="task-description"
              label={t("tasks.fieldDescription")}
              error={errors.description?.message ? t(errors.description.message) : undefined}
            >
              <textarea
                id="task-description"
                className="input min-h-32 resize-y"
                dir="auto"
                disabled={contentDisabled}
                aria-invalid={Boolean(errors.description)}
                {...register("description")}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="task-due" label={t("tasks.fieldDueAt")}>
                <DatePicker
                  id="task-due"
                  ariaLabel={t("tasks.fieldDueAt")}
                  showTime
                  disabled={contentDisabled}
                  value={watch("dueAt") ? new Date(watch("dueAt")) : undefined}
                  onChange={(date) =>
                    setValue("dueAt", date ? date.toISOString() : "", { shouldDirty: true })
                  }
                />
                <span className="mt-1.5 block text-xs text-muted-foreground">{t("tasks.dueAtHelp")}</span>
              </Field>

              {isEditing && (
                <Field id="task-status" label={t("tasks.fieldStatus")}>
                  <AppSelect
                    id="task-status"
                    ariaLabel={t("tasks.fieldStatus")}
                    value={watch("status")}
                    onValueChange={(value) => setValue("status", value as TaskFormValues["status"])}
                    options={statusOptions}
                    disabled={!scope.canEditStatus}
                  />
                </Field>
              )}
            </div>

            {scope.canReassign && (
              <Field id="task-assignee" label={t("tasks.fieldAssignee")}>
                <AppSelect
                  id="task-assignee"
                  ariaLabel={t("tasks.fieldAssignee")}
                  searchable
                  searchPlaceholder={t("tickets.searchAssignee")}
                  emptySearchMessage={t("tickets.noAssigneesFound")}
                  value={watch("assigneeId") ?? ""}
                  onValueChange={(value) => setValue("assigneeId", value)}
                  options={assigneeOptions}
                />
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  {t("tasks.assigneeHelp")}
                </span>
              </Field>
            )}
          </div>
          <div className="flex flex-col-reverse gap-3 rounded-b-xl border-t border-border bg-surface-subtle/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Link className="button-secondary text-center" to={isEditing ? `/tasks/${id}` : "/tasks"}>
              {t("common.cancel")}
            </Link>
            <button className="button-link" type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </TasksPage>
  );
}

function buildCreatePayload(values: TaskFormValues): TaskCreatePayload {
  const payload: TaskCreatePayload = { title: values.title.trim() };
  const description = values.description.trim();
  if (description) payload.description = description;
  const dueAt = localInputToIso(values.dueAt.trim());
  if (dueAt) payload.dueAt = dueAt;
  if (values.assigneeId) payload.assigneeId = values.assigneeId;
  return payload;
}

function buildUpdatePayload(
  values: TaskFormValues,
  scope: { canEditContent: boolean; canReassign: boolean },
): TaskUpdatePayload {
  const payload: TaskUpdatePayload = { status: values.status };
  if (scope.canEditContent) {
    payload.title = values.title.trim();
    payload.description = values.description.trim() || null;
    payload.dueAt = localInputToIso(values.dueAt.trim()) || null;
  }
  if (scope.canReassign && values.assigneeId) payload.assigneeId = values.assigneeId;
  return payload;
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground" htmlFor={id}>
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      <div className="mt-2">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
