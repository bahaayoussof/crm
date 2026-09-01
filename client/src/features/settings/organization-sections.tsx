import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Building2, Network, Pencil, Power, Trash2, Users2 } from "lucide-react";
import axios from "axios";
import { AppSelectField } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DataTableSearch,
  DataTableSkeleton,
  DataTableSurface,
  DataTableToolbar,
  DataTablePagination,
} from "@/components/shared/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import {
  useAdminBranches,
  useAdminDepartments,
  useAdminTeams,
  useBranchOptions,
  useCreateBranch,
  useCreateDepartment,
  useCreateTeam,
  useDeleteBranch,
  useDeleteDepartment,
  useDeleteTeam,
  useDepartmentOptions,
  useUpdateBranch,
  useUpdateDepartment,
  useUpdateTeam,
} from "@/features/organization/organization-hooks";
import { useManagerOptions } from "@/features/users/user-hooks";
import type { Branch, Department, Team } from "@/features/organization/organization.types";

const PAGE_SIZE = 15;
type StatusFilter = "" | "active" | "inactive";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function OrgStatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return <Badge variant={active ? "success" : "neutral"}>{active ? t("settings.active") : t("settings.inactive")}</Badge>;
}

function OrgState({ text, action }: { text: string; action?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      <p>{text}</p>
      {action && (
        <Button className="mt-3" variant="secondary" onClick={action}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

/** One portalled alert dialog reused for activate / deactivate / delete. */
function OrgConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="org-confirm-title"
        aria-describedby="org-confirm-description"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-flyout"
      >
        <div className="flex size-10 items-center justify-center rounded-lg bg-surface-subtle text-muted-foreground">
          <Power className="size-5" aria-hidden="true" />
        </div>
        <h2 id="org-confirm-title" className="pt-3 text-base font-semibold" dir="auto">
          {title}
        </h2>
        <p id="org-confirm-description" className="mt-1 text-sm text-muted-foreground" dir="auto">
          {description}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant={destructive ? "destructive" : "primary"} isLoading={pending} onClick={onConfirm}>
            {error ? t("common.retry") : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function apiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<{ error?: { code?: string } }>(error)) return error.response?.data?.error?.code;
  return undefined;
}

function StatusFilterSelect({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  const { t } = useTranslation();
  return (
    <div className="w-32 sm:w-36">
      <AppSelectField
        id="org-status-filter"
        label={t("settings.status")}
        hideLabel
        value={value}
        onValueChange={(next) => onChange(next as StatusFilter)}
        options={[
          { value: "", label: t("settings.allStatuses") },
          { value: "active", label: t("settings.active") },
          { value: "inactive", label: t("settings.inactive") },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

type DeptEditorTarget = Department | "new" | null;

export function DepartmentsSection() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const query = useAdminDepartments({
    search: debouncedSearch,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const branchOptions = useBranchOptions();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const remove = useDeleteDepartment();

  const [editorTarget, setEditorTarget] = useState<DeptEditorTarget>(null);
  const [statusTarget, setStatusTarget] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters = Boolean(debouncedSearch || status);
  const editorPending = create.isPending || update.isPending;

  const branchSelectOptions = useMemo(
    () => [
      { value: "", label: t("settings.departments.noBranch") },
      ...(branchOptions.data ?? []).map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branchOptions.data, t],
  );

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Network className="size-4" />
            {t("settings.departments.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("settings.departments.description")}</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setEditorTarget("new")}>
          {t("settings.departments.create")}
        </Button>
      </header>

      <DataTableSurface>
        <DataTableToolbar>
          <DataTableSearch
            id="department-search"
            ariaLabel={t("settings.departments.search")}
            value={search}
            onChange={setSearch}
            placeholder={t("settings.departments.search")}
          />
          <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
            <StatusFilterSelect value={status} onChange={setStatus} />
            {hasFilters && (
              <button
                className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                {t("settings.clearFilters")}
              </button>
            )}
          </div>
        </DataTableToolbar>

        {query.isLoading ? (
          <div className="p-4">
            <DataTableSkeleton columns={6} />
          </div>
        ) : query.isError ? (
          <div className="p-6">
            <OrgState text={t("settings.departments.loadError")} action={() => query.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <OrgState text={hasFilters ? t("settings.departments.noResults") : t("settings.departments.empty")} />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[46rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.departments.name")}</TableHead>
                    <TableHead>{t("settings.departments.fieldDescription")}</TableHead>
                    <TableHead>{t("settings.departments.branch")}</TableHead>
                    <TableHead className="w-20 text-end">{t("settings.departments.users")}</TableHead>
                    <TableHead className="w-28">{t("settings.status")}</TableHead>
                    <TableHead className="w-24 text-end">{t("settings.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium" dir="auto">
                        {row.name}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground" title={row.description ?? ""}>
                        {row.description || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground" dir="auto">
                        {row.branch?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">{row.userCount}</TableCell>
                      <TableCell>
                        <OrgStatusBadge active={row.isActive} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <DeptRowActions
                            row={row}
                            onEdit={() => setEditorTarget(row)}
                            onToggle={() => {
                              setStatusError(null);
                              setStatusTarget(row);
                            }}
                            onDelete={() => {
                              setDeleteError(null);
                              setDeleteTarget(row);
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border-subtle md:hidden">
              {rows.map((row) => (
                <li className="p-4" key={row.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium" dir="auto">
                        {row.name}
                      </p>
                      <p className="mt-1 break-words text-sm text-muted-foreground" dir="auto">
                        {row.description || "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("settings.departments.branch")}: {row.branch?.name ?? "—"} · {t("settings.departments.users")}:{" "}
                        {row.userCount}
                      </p>
                    </div>
                    <OrgStatusBadge active={row.isActive} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <DeptRowActions
                      row={row}
                      onEdit={() => setEditorTarget(row)}
                      onToggle={() => {
                        setStatusError(null);
                        setStatusTarget(row);
                      }}
                      onDelete={() => {
                        setDeleteError(null);
                        setDeleteTarget(row);
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {meta && meta.totalPages > 1 && (
              <div className="border-t border-table-border px-3.5 py-2">
                <DataTablePagination
                  page={page}
                  pageCount={meta.totalPages}
                  pageSize={PAGE_SIZE}
                  totalCount={meta.total}
                  canPreviousPage={page > 1}
                  canNextPage={page < meta.totalPages}
                  onPreviousPage={() => setPage((value) => Math.max(1, value - 1))}
                  onNextPage={() => setPage((value) => value + 1)}
                  ariaLabel={t("settings.departments.pagination")}
                />
              </div>
            )}
          </>
        )}
      </DataTableSurface>

      {editorTarget && (
        <DepartmentEditorDialog
          department={editorTarget === "new" ? null : editorTarget}
          branchOptions={branchSelectOptions}
          pending={editorPending}
          onClose={() => setEditorTarget(null)}
          onSubmit={async (values) => {
            if (editorTarget === "new") await create.mutateAsync(values);
            else await update.mutateAsync({ id: editorTarget.id, input: values });
            setEditorTarget(null);
          }}
        />
      )}

      {statusTarget && (
        <OrgConfirmDialog
          title={t(
            statusTarget.isActive ? "settings.departments.deactivateTitle" : "settings.departments.activateTitle",
            { name: statusTarget.name },
          )}
          description={t(
            statusTarget.isActive ? "settings.departments.confirmDeactivate" : "settings.departments.confirmActivate",
          )}
          confirmLabel={t(statusTarget.isActive ? "settings.deactivate" : "settings.activate")}
          destructive={statusTarget.isActive}
          pending={update.isPending}
          error={statusError}
          onClose={() => setStatusTarget(null)}
          onConfirm={async () => {
            setStatusError(null);
            try {
              await update.mutateAsync({ id: statusTarget.id, input: { isActive: !statusTarget.isActive } });
              setStatusTarget(null);
            } catch {
              setStatusError(t("settings.departments.statusError"));
            }
          }}
        />
      )}

      {deleteTarget && (
        <OrgConfirmDialog
          title={t("settings.departments.deleteTitle", { name: deleteTarget.name })}
          description={t("settings.departments.confirmDelete")}
          confirmLabel={t("settings.delete")}
          destructive
          pending={remove.isPending}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setDeleteError(null);
            try {
              await remove.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            } catch (error) {
              setDeleteError(
                apiErrorCode(error) === "DEPARTMENT_IN_USE"
                  ? t("settings.departments.deleteConflict")
                  : t("settings.departments.deleteError"),
              );
            }
          }}
        />
      )}
    </section>
  );
}

function DeptRowActions({
  row,
  onEdit,
  onToggle,
  onDelete,
}: {
  row: Department;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ActionMenu
      triggerLabel={t("settings.actions")}
      items={[
        { key: "edit", label: t("common.edit"), icon: <Pencil className="size-4" />, onClick: onEdit },
        {
          key: "status",
          label: row.isActive ? t("settings.deactivate") : t("settings.activate"),
          icon: <Power className="size-4" />,
          destructive: row.isActive,
          onClick: onToggle,
        },
        {
          key: "delete",
          label: t("settings.delete"),
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onClick: onDelete,
        },
      ]}
    />
  );
}

function DepartmentEditorDialog({
  department,
  branchOptions,
  pending,
  onClose,
  onSubmit,
}: {
  department: Department | null;
  branchOptions: { value: string; label: string }[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string; branchId: string | null }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(department?.name ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [branchId, setBranchId] = useState(department?.branchId ?? "");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (name.trim().length < 2) {
      setError(t("settings.departments.validation"));
      return;
    }
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), branchId: branchId || null });
    } catch {
      setError(t("settings.departments.saveError"));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
      title={t(department ? "settings.departments.edit" : "settings.departments.create")}
      description={t("settings.departments.formDescription")}
    >
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          {t("settings.departments.name")}
          <Input className="mt-1" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} dir="auto" />
        </label>
        <label className="block text-sm font-medium">
          {t("settings.departments.fieldDescription")}
          <Textarea
            className="mt-1"
            value={description}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
            dir="auto"
          />
        </label>
        <AppSelectField
          id="department-branch"
          label={t("settings.departments.branch")}
          searchable
          value={branchId}
          onValueChange={setBranchId}
          options={branchOptions}
          searchPlaceholder={t("common.search")}
          emptySearchMessage={t("common.noResults")}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button isLoading={pending} onClick={submit}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

type BranchEditorTarget = Branch | "new" | null;

export function BranchesSection() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const query = useAdminBranches({
    search: debouncedSearch,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const remove = useDeleteBranch();

  const [editorTarget, setEditorTarget] = useState<BranchEditorTarget>(null);
  const [statusTarget, setStatusTarget] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters = Boolean(debouncedSearch || status);
  const editorPending = create.isPending || update.isPending;

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Building2 className="size-4" />
            {t("settings.branches.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("settings.branches.description")}</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setEditorTarget("new")}>
          {t("settings.branches.create")}
        </Button>
      </header>

      <DataTableSurface>
        <DataTableToolbar>
          <DataTableSearch
            id="branch-search"
            ariaLabel={t("settings.branches.search")}
            value={search}
            onChange={setSearch}
            placeholder={t("settings.branches.search")}
          />
          <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
            <StatusFilterSelect value={status} onChange={setStatus} />
            {hasFilters && (
              <button
                className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                {t("settings.clearFilters")}
              </button>
            )}
          </div>
        </DataTableToolbar>

        {query.isLoading ? (
          <div className="p-4">
            <DataTableSkeleton columns={6} />
          </div>
        ) : query.isError ? (
          <div className="p-6">
            <OrgState text={t("settings.branches.loadError")} action={() => query.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <OrgState text={hasFilters ? t("settings.branches.noResults") : t("settings.branches.empty")} />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[48rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.branches.name")}</TableHead>
                    <TableHead className="w-28">{t("settings.branches.code")}</TableHead>
                    <TableHead>{t("settings.branches.address")}</TableHead>
                    <TableHead className="w-20 text-end">{t("settings.branches.users")}</TableHead>
                    <TableHead className="w-28">{t("settings.status")}</TableHead>
                    <TableHead className="w-24 text-end">{t("settings.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium" dir="auto">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">
                        {row.code || "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground" title={row.address ?? ""} dir="auto">
                        {row.address || "—"}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">{row.userCount}</TableCell>
                      <TableCell>
                        <OrgStatusBadge active={row.isActive} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <BranchRowActions
                            row={row}
                            onEdit={() => setEditorTarget(row)}
                            onToggle={() => {
                              setStatusError(null);
                              setStatusTarget(row);
                            }}
                            onDelete={() => {
                              setDeleteError(null);
                              setDeleteTarget(row);
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border-subtle md:hidden">
              {rows.map((row) => (
                <li className="p-4" key={row.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium" dir="auto">
                        {row.name}
                      </p>
                      {row.code && (
                        <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                          {row.code}
                        </p>
                      )}
                      <p className="mt-1 break-words text-sm text-muted-foreground" dir="auto">
                        {row.address || "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("settings.branches.users")}: {row.userCount}
                      </p>
                    </div>
                    <OrgStatusBadge active={row.isActive} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <BranchRowActions
                      row={row}
                      onEdit={() => setEditorTarget(row)}
                      onToggle={() => {
                        setStatusError(null);
                        setStatusTarget(row);
                      }}
                      onDelete={() => {
                        setDeleteError(null);
                        setDeleteTarget(row);
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {meta && meta.totalPages > 1 && (
              <div className="border-t border-table-border px-3.5 py-2">
                <DataTablePagination
                  page={page}
                  pageCount={meta.totalPages}
                  pageSize={PAGE_SIZE}
                  totalCount={meta.total}
                  canPreviousPage={page > 1}
                  canNextPage={page < meta.totalPages}
                  onPreviousPage={() => setPage((value) => Math.max(1, value - 1))}
                  onNextPage={() => setPage((value) => value + 1)}
                  ariaLabel={t("settings.branches.pagination")}
                />
              </div>
            )}
          </>
        )}
      </DataTableSurface>

      {editorTarget && (
        <BranchEditorDialog
          branch={editorTarget === "new" ? null : editorTarget}
          pending={editorPending}
          onClose={() => setEditorTarget(null)}
          onSubmit={async (values) => {
            if (editorTarget === "new") await create.mutateAsync(values);
            else await update.mutateAsync({ id: editorTarget.id, input: values });
            setEditorTarget(null);
          }}
        />
      )}

      {statusTarget && (
        <OrgConfirmDialog
          title={t(
            statusTarget.isActive ? "settings.branches.deactivateTitle" : "settings.branches.activateTitle",
            { name: statusTarget.name },
          )}
          description={t(
            statusTarget.isActive ? "settings.branches.confirmDeactivate" : "settings.branches.confirmActivate",
          )}
          confirmLabel={t(statusTarget.isActive ? "settings.deactivate" : "settings.activate")}
          destructive={statusTarget.isActive}
          pending={update.isPending}
          error={statusError}
          onClose={() => setStatusTarget(null)}
          onConfirm={async () => {
            setStatusError(null);
            try {
              await update.mutateAsync({ id: statusTarget.id, input: { isActive: !statusTarget.isActive } });
              setStatusTarget(null);
            } catch {
              setStatusError(t("settings.branches.statusError"));
            }
          }}
        />
      )}

      {deleteTarget && (
        <OrgConfirmDialog
          title={t("settings.branches.deleteTitle", { name: deleteTarget.name })}
          description={t("settings.branches.confirmDelete")}
          confirmLabel={t("settings.delete")}
          destructive
          pending={remove.isPending}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setDeleteError(null);
            try {
              await remove.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            } catch (error) {
              setDeleteError(
                apiErrorCode(error) === "BRANCH_IN_USE"
                  ? t("settings.branches.deleteConflict")
                  : t("settings.branches.deleteError"),
              );
            }
          }}
        />
      )}
    </section>
  );
}

function BranchRowActions({
  row,
  onEdit,
  onToggle,
  onDelete,
}: {
  row: Branch;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ActionMenu
      triggerLabel={t("settings.actions")}
      items={[
        { key: "edit", label: t("common.edit"), icon: <Pencil className="size-4" />, onClick: onEdit },
        {
          key: "status",
          label: row.isActive ? t("settings.deactivate") : t("settings.activate"),
          icon: <Power className="size-4" />,
          destructive: row.isActive,
          onClick: onToggle,
        },
        {
          key: "delete",
          label: t("settings.delete"),
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onClick: onDelete,
        },
      ]}
    />
  );
}

function BranchEditorDialog({
  branch,
  pending,
  onClose,
  onSubmit,
}: {
  branch: Branch | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; code: string | null; address: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(branch?.name ?? "");
  const [code, setCode] = useState(branch?.code ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (name.trim().length < 2) {
      setError(t("settings.branches.validation"));
      return;
    }
    try {
      await onSubmit({ name: name.trim(), code: code.trim() || null, address: address.trim() });
    } catch {
      setError(t("settings.branches.saveError"));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
      title={t(branch ? "settings.branches.edit" : "settings.branches.create")}
      description={t("settings.branches.formDescription")}
    >
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          {t("settings.branches.name")}
          <Input className="mt-1" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} dir="auto" />
        </label>
        <label className="block text-sm font-medium">
          {t("settings.branches.code")}
          <Input
            className="mt-1"
            value={code}
            maxLength={40}
            onChange={(event) => setCode(event.target.value)}
            dir="ltr"
          />
        </label>
        <label className="block text-sm font-medium">
          {t("settings.branches.address")}
          <Textarea
            className="mt-1"
            value={address}
            maxLength={300}
            onChange={(event) => setAddress(event.target.value)}
            dir="auto"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button isLoading={pending} onClick={submit}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Teams (feature/team-based-manager-scope)
// ---------------------------------------------------------------------------

type TeamEditorTarget = Team | "new" | null;

function teamErrorKey(code: string | undefined): string | null {
  switch (code) {
    case "MANAGER_ALREADY_LEADS_TEAM":
      return "settings.teams.errors.managerAlreadyLeads";
    case "TEAM_NAME_ALREADY_EXISTS":
      return "settings.teams.errors.nameExists";
    case "INVALID_TEAM_MANAGER":
      return "settings.teams.errors.invalidManager";
    case "INVALID_DEPARTMENT":
      return "settings.teams.errors.invalidDepartment";
    case "TEAM_DEPARTMENT_MISMATCH":
      return "settings.teams.errors.departmentMismatch";
    default:
      return null;
  }
}

export function TeamsSection() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const query = useAdminTeams({
    search: debouncedSearch,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const create = useCreateTeam();
  const update = useUpdateTeam();
  const remove = useDeleteTeam();

  const [editorTarget, setEditorTarget] = useState<TeamEditorTarget>(null);
  const [statusTarget, setStatusTarget] = useState<Team | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const hasFilters = Boolean(debouncedSearch || status);
  const editorPending = create.isPending || update.isPending;

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Users2 className="size-4" />
            {t("settings.teams.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("settings.teams.description")}</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setEditorTarget("new")}>
          {t("settings.teams.create")}
        </Button>
      </header>

      <DataTableSurface>
        <DataTableToolbar>
          <DataTableSearch
            id="team-search"
            ariaLabel={t("settings.teams.search")}
            value={search}
            onChange={setSearch}
            placeholder={t("settings.teams.search")}
          />
          <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
            <StatusFilterSelect value={status} onChange={setStatus} />
            {hasFilters && (
              <button
                className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                {t("settings.clearFilters")}
              </button>
            )}
          </div>
        </DataTableToolbar>

        {query.isLoading ? (
          <div className="p-4">
            <DataTableSkeleton columns={6} />
          </div>
        ) : query.isError ? (
          <div className="p-6">
            <OrgState text={t("settings.teams.loadError")} action={() => query.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <OrgState text={hasFilters ? t("settings.teams.noResults") : t("settings.teams.empty")} />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[52rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.teams.name")}</TableHead>
                    <TableHead>{t("settings.teams.department")}</TableHead>
                    <TableHead>{t("settings.teams.manager")}</TableHead>
                    <TableHead className="w-20 text-end">{t("settings.teams.agents")}</TableHead>
                    <TableHead className="w-28">{t("settings.status")}</TableHead>
                    <TableHead className="w-24 text-end">{t("settings.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium" dir="auto">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground" dir="auto">
                        {row.department?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground" dir="auto">
                        {row.manager ? (
                          <span className="flex flex-col">
                            <span className="text-foreground">{row.manager.name}</span>
                            <span className="truncate text-xs" dir="ltr">
                              {row.manager.email}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{t("settings.teams.noManager")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">{row.agentCount}</TableCell>
                      <TableCell>
                        <OrgStatusBadge active={row.isActive} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <TeamRowActions
                            row={row}
                            onEdit={() => setEditorTarget(row)}
                            onToggle={() => {
                              setStatusError(null);
                              setStatusTarget(row);
                            }}
                            onDelete={() => {
                              setDeleteError(null);
                              setDeleteTarget(row);
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border-subtle md:hidden">
              {rows.map((row) => (
                <li className="p-4" key={row.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium" dir="auto">
                        {row.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground" dir="auto">
                        {t("settings.teams.department")}: {row.department?.name ?? "—"} ·{" "}
                        {t("settings.teams.agents")}: {row.agentCount}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground" dir="auto">
                        {t("settings.teams.manager")}: {row.manager?.name ?? t("settings.teams.noManager")}
                      </p>
                    </div>
                    <OrgStatusBadge active={row.isActive} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <TeamRowActions
                      row={row}
                      onEdit={() => setEditorTarget(row)}
                      onToggle={() => {
                        setStatusError(null);
                        setStatusTarget(row);
                      }}
                      onDelete={() => {
                        setDeleteError(null);
                        setDeleteTarget(row);
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {meta && meta.totalPages > 1 && (
              <div className="border-t border-table-border px-3.5 py-2">
                <DataTablePagination
                  page={page}
                  pageCount={meta.totalPages}
                  pageSize={PAGE_SIZE}
                  totalCount={meta.total}
                  canPreviousPage={page > 1}
                  canNextPage={page < meta.totalPages}
                  onPreviousPage={() => setPage((value) => Math.max(1, value - 1))}
                  onNextPage={() => setPage((value) => value + 1)}
                  ariaLabel={t("settings.teams.pagination")}
                />
              </div>
            )}
          </>
        )}
      </DataTableSurface>

      {editorTarget && (
        <TeamEditorDialog
          team={editorTarget === "new" ? null : editorTarget}
          pending={editorPending}
          onClose={() => setEditorTarget(null)}
          onSubmit={async (values) => {
            if (editorTarget === "new") await create.mutateAsync(values);
            else await update.mutateAsync({ id: editorTarget.id, input: values });
            setEditorTarget(null);
          }}
        />
      )}

      {statusTarget && (
        <OrgConfirmDialog
          title={t(statusTarget.isActive ? "settings.teams.deactivateTitle" : "settings.teams.activateTitle", {
            name: statusTarget.name,
          })}
          description={t(statusTarget.isActive ? "settings.teams.confirmDeactivate" : "settings.teams.confirmActivate")}
          confirmLabel={t(statusTarget.isActive ? "settings.deactivate" : "settings.activate")}
          destructive={statusTarget.isActive}
          pending={update.isPending}
          error={statusError}
          onClose={() => setStatusTarget(null)}
          onConfirm={async () => {
            setStatusError(null);
            try {
              await update.mutateAsync({ id: statusTarget.id, input: { isActive: !statusTarget.isActive } });
              setStatusTarget(null);
            } catch {
              setStatusError(t("settings.teams.statusError"));
            }
          }}
        />
      )}

      {deleteTarget && (
        <OrgConfirmDialog
          title={t("settings.teams.deleteTitle", { name: deleteTarget.name })}
          description={t("settings.teams.confirmDelete")}
          confirmLabel={t("settings.delete")}
          destructive
          pending={remove.isPending}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setDeleteError(null);
            try {
              await remove.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            } catch (error) {
              const code = apiErrorCode(error);
              setDeleteError(
                code === "TEAM_IN_USE"
                  ? t("settings.teams.deleteConflictInUse")
                  : code === "TEAM_HAS_TICKETS"
                    ? t("settings.teams.deleteConflictTickets")
                    : t("settings.teams.deleteError"),
              );
            }
          }}
        />
      )}
    </section>
  );
}

function TeamRowActions({
  row,
  onEdit,
  onToggle,
  onDelete,
}: {
  row: Team;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ActionMenu
      triggerLabel={t("settings.actions")}
      items={[
        { key: "edit", label: t("common.edit"), icon: <Pencil className="size-4" />, onClick: onEdit },
        {
          key: "status",
          label: row.isActive ? t("settings.deactivate") : t("settings.activate"),
          icon: <Power className="size-4" />,
          destructive: row.isActive,
          onClick: onToggle,
        },
        {
          key: "delete",
          label: t("settings.delete"),
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onClick: onDelete,
        },
      ]}
    />
  );
}

function TeamEditorDialog({
  team,
  pending,
  onClose,
  onSubmit,
}: {
  team: Team | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; departmentId: string; managerId: string | null }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const departments = useDepartmentOptions();
  const managers = useManagerOptions();
  const [name, setName] = useState(team?.name ?? "");
  const [departmentId, setDepartmentId] = useState(team?.departmentId ?? "");
  const [managerId, setManagerId] = useState(team?.managerId ?? "");
  const [error, setError] = useState("");

  const departmentOptions = useMemo(
    () => [
      { value: "", label: t("settings.teams.selectDepartment") },
      ...(departments.data ?? []).map((department) => ({ value: department.id, label: department.name })),
    ],
    [departments.data, t],
  );

  const managerOptions = useMemo(() => {
    const list = managers.data ?? [];
    const known = new Set(list.map((manager) => manager.id));
    const options = list.map((manager) => ({ value: manager.id, label: manager.name, searchText: manager.email }));
    if (team?.manager && !known.has(team.manager.id)) {
      options.unshift({ value: team.manager.id, label: team.manager.name, searchText: team.manager.email });
    }
    return [{ value: "", label: t("settings.teams.noManager") }, ...options];
  }, [managers.data, team, t]);

  const submit = async () => {
    setError("");
    if (name.trim().length < 2) {
      setError(t("settings.teams.validation.name"));
      return;
    }
    if (!departmentId) {
      setError(t("settings.teams.validation.department"));
      return;
    }
    try {
      await onSubmit({ name: name.trim(), departmentId, managerId: managerId || null });
    } catch (err) {
      const key = teamErrorKey(apiErrorCode(err));
      setError(key ? t(key) : t("settings.teams.saveError"));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
      title={t(team ? "settings.teams.edit" : "settings.teams.create")}
      description={t("settings.teams.formDescription")}
    >
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          {t("settings.teams.name")}
          <Input
            className="mt-1"
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            dir="auto"
          />
        </label>
        <AppSelectField
          id="team-department"
          label={t("settings.teams.department")}
          searchable
          value={departmentId}
          onValueChange={setDepartmentId}
          options={departmentOptions}
          searchPlaceholder={t("common.search")}
          emptySearchMessage={t("common.noResults")}
        />
        <AppSelectField
          id="team-manager"
          label={t("settings.teams.manager")}
          helperText={t("settings.teams.managerHelp")}
          searchable
          value={managerId}
          onValueChange={setManagerId}
          options={managerOptions}
          searchPlaceholder={t("common.search")}
          emptySearchMessage={t("common.noResults")}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button isLoading={pending} onClick={submit}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
