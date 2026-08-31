import { useMemo } from "react";
import {
  Controller,
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AppSelectField } from "@/components/ui/app-select";
import { useBranchOptions, useDepartmentOptions } from "@/features/organization/organization-hooks";

type OrgForm = { branchId?: string; departmentId?: string };

/**
 * Branch-first, dependent Branch/Department selectors for internal-user create
 * and edit. Branch is rendered first; Department is disabled until a Branch is
 * selected and then only lists active Departments belonging to that Branch.
 * Changing the Branch clears a Department that no longer belongs to it. The
 * backend still validates every combination (`INVALID_BRANCH`,
 * `INVALID_DEPARTMENT`, `DEPARTMENT_BRANCH_MISMATCH`) — this only prevents the
 * invalid UX.
 */
export function UserBranchDepartmentFields<TFieldValues extends FieldValues & OrgForm>({
  control,
  setValue,
  idPrefix,
}: {
  control: Control<TFieldValues>;
  setValue: UseFormSetValue<TFieldValues>;
  idPrefix: string;
}) {
  const { t } = useTranslation();
  const branches = useBranchOptions();
  const departments = useDepartmentOptions();

  const branchName = "branchId" as Path<TFieldValues>;
  const departmentName = "departmentId" as Path<TFieldValues>;

  const branchId = (useWatch({ control, name: branchName }) as string | undefined) ?? "";
  const departmentId = (useWatch({ control, name: departmentName }) as string | undefined) ?? "";

  const departmentDisabled = !branchId;

  const branchOptions = useMemo(
    () => [
      { value: "", label: t("users.branchNone") },
      ...(branches.data ?? []).map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branches.data, t],
  );

  const currentDepartmentLabel = useMemo(
    () => (departments.data ?? []).find((department) => department.id === departmentId)?.name ?? departmentId,
    [departments.data, departmentId],
  );

  const departmentOptions = useMemo(() => {
    if (!branchId) return [];
    const forBranch = (departments.data ?? []).filter((department) => department.branchId === branchId);
    const options = forBranch.map((department) => ({ value: department.id, label: department.name }));
    // Keep a preserved-but-not-in-this-branch value visible so the field is never blank.
    if (departmentId && !forBranch.some((department) => department.id === departmentId)) {
      options.unshift({ value: departmentId, label: currentDepartmentLabel });
    }
    return [{ value: "", label: t("users.departmentNone") }, ...options];
  }, [branchId, departmentId, departments.data, currentDepartmentLabel, t]);

  const handleBranchChange = (nextBranchId: string) => {
    setValue(branchName, nextBranchId as PathValue<TFieldValues, Path<TFieldValues>>, {
      shouldDirty: true,
    });
    const currentDepartment = (departments.data ?? []).find((department) => department.id === departmentId);
    if (!nextBranchId || !currentDepartment || currentDepartment.branchId !== nextBranchId) {
      setValue(departmentName, "" as PathValue<TFieldValues, Path<TFieldValues>>, { shouldDirty: true });
    }
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Controller
        control={control}
        name={branchName}
        render={({ field }) => (
          <AppSelectField
            id={`${idPrefix}-branch`}
            label={t("users.fieldBranch")}
            searchable
            value={(field.value as string | undefined) ?? ""}
            onValueChange={handleBranchChange}
            options={branchOptions}
            searchPlaceholder={t("common.search")}
            emptySearchMessage={t("common.noResults")}
          />
        )}
      />
      <Controller
        control={control}
        name={departmentName}
        render={({ field }) => (
          <AppSelectField
            id={`${idPrefix}-department`}
            label={t("users.fieldDepartment")}
            searchable
            disabled={departmentDisabled}
            value={(field.value as string | undefined) ?? ""}
            onValueChange={(value) => field.onChange(value as PathValue<TFieldValues, Path<TFieldValues>>)}
            options={
              departmentDisabled
                ? departmentId
                  ? [{ value: departmentId, label: currentDepartmentLabel }]
                  : []
                : departmentOptions
            }
            placeholder={departmentDisabled ? t("users.selectBranchFirst") : undefined}
            searchPlaceholder={t("common.search")}
            emptySearchMessage={t("common.noResults")}
          />
        )}
      />
    </div>
  );
}
