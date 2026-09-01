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
import { useBranchOptions, useDepartmentOptions, useTeamOptions } from "@/features/organization/organization-hooks";
import type { ManageableRole } from "./user.types";

type OrgForm = { branchId?: string; departmentId?: string; teamId?: string };

/**
 * Branch-first, dependent Branch → Department → Team selectors for internal-user
 * create and edit. Branch is rendered first; Department is disabled until a
 * Branch is selected and then only lists active Departments of that Branch;
 * Team is shown for MANAGER / AGENT only, is disabled until a Department is
 * selected, and only lists active Teams of that Department. Changing a parent
 * clears an incompatible child. The backend still validates every combination
 * (`INVALID_BRANCH`, `INVALID_DEPARTMENT`, `DEPARTMENT_BRANCH_MISMATCH`,
 * `INVALID_TEAM`, `TEAM_DEPARTMENT_MISMATCH`, `TEAM_ALREADY_HAS_MANAGER`,
 * `AGENT_HAS_ACTIVE_TICKETS`) — this only prevents the invalid UX.
 */
export function UserBranchDepartmentFields<TFieldValues extends FieldValues & OrgForm>({
  control,
  setValue,
  idPrefix,
  role,
}: {
  control: Control<TFieldValues>;
  setValue: UseFormSetValue<TFieldValues>;
  idPrefix: string;
  /** When MANAGER / AGENT, the dependent Team select is rendered. */
  role?: ManageableRole;
}) {
  const { t } = useTranslation();
  const branches = useBranchOptions();
  const departments = useDepartmentOptions();

  const branchName = "branchId" as Path<TFieldValues>;
  const departmentName = "departmentId" as Path<TFieldValues>;
  const teamName = "teamId" as Path<TFieldValues>;

  const branchId = (useWatch({ control, name: branchName }) as string | undefined) ?? "";
  const departmentId = (useWatch({ control, name: departmentName }) as string | undefined) ?? "";
  const teamId = (useWatch({ control, name: teamName }) as string | undefined) ?? "";

  const showTeam = role === "MANAGER" || role === "AGENT";
  const departmentDisabled = !branchId;
  const teamDisabled = !departmentId;

  const teams = useTeamOptions(departmentId || undefined, { enabled: showTeam });

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

  const currentTeamLabel = useMemo(
    () => (teams.data ?? []).find((team) => team.id === teamId)?.name ?? teamId,
    [teams.data, teamId],
  );

  const departmentOptions = useMemo(() => {
    if (!branchId) return [];
    const forBranch = (departments.data ?? []).filter((department) => department.branchId === branchId);
    const options = forBranch.map((department) => ({ value: department.id, label: department.name }));
    if (departmentId && !forBranch.some((department) => department.id === departmentId)) {
      options.unshift({ value: departmentId, label: currentDepartmentLabel });
    }
    return [{ value: "", label: t("users.departmentNone") }, ...options];
  }, [branchId, departmentId, departments.data, currentDepartmentLabel, t]);

  const teamOptions = useMemo(() => {
    if (!departmentId) return [];
    const forDepartment = (teams.data ?? []).filter((team) => team.departmentId === departmentId);
    const options = forDepartment.map((team) => ({ value: team.id, label: team.name }));
    if (teamId && !forDepartment.some((team) => team.id === teamId)) {
      options.unshift({ value: teamId, label: currentTeamLabel });
    }
    return [{ value: "", label: t("users.teamNone") }, ...options];
  }, [departmentId, teamId, teams.data, currentTeamLabel, t]);

  const clearTeamIfIncompatible = (nextDepartmentId: string) => {
    if (!showTeam) return;
    const currentTeam = (teams.data ?? []).find((team) => team.id === teamId);
    if (!nextDepartmentId || !currentTeam || currentTeam.departmentId !== nextDepartmentId) {
      setValue(teamName, "" as PathValue<TFieldValues, Path<TFieldValues>>, { shouldDirty: true });
    }
  };

  const handleBranchChange = (nextBranchId: string) => {
    setValue(branchName, nextBranchId as PathValue<TFieldValues, Path<TFieldValues>>, { shouldDirty: true });
    const currentDepartment = (departments.data ?? []).find((department) => department.id === departmentId);
    if (!nextBranchId || !currentDepartment || currentDepartment.branchId !== nextBranchId) {
      setValue(departmentName, "" as PathValue<TFieldValues, Path<TFieldValues>>, { shouldDirty: true });
      clearTeamIfIncompatible("");
    } else {
      clearTeamIfIncompatible(departmentId);
    }
  };

  const handleDepartmentChange = (nextDepartmentId: string) => {
    setValue(departmentName, nextDepartmentId as PathValue<TFieldValues, Path<TFieldValues>>, { shouldDirty: true });
    clearTeamIfIncompatible(nextDepartmentId);
  };

  return (
    <div className="space-y-5">
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
              onValueChange={handleDepartmentChange}
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
      {showTeam && (
        <Controller
          control={control}
          name={teamName}
          render={({ field }) => (
            <AppSelectField
              id={`${idPrefix}-team`}
              label={t("users.fieldTeam")}
              helperText={role === "MANAGER" ? t("users.teamManagerHelp") : t("users.teamAgentHelp")}
              searchable
              disabled={teamDisabled}
              value={(field.value as string | undefined) ?? ""}
              onValueChange={(value) => field.onChange(value as PathValue<TFieldValues, Path<TFieldValues>>)}
              options={
                teamDisabled ? (teamId ? [{ value: teamId, label: currentTeamLabel }] : []) : teamOptions
              }
              placeholder={teamDisabled ? t("users.selectDepartmentFirst") : undefined}
              searchPlaceholder={t("common.search")}
              emptySearchMessage={teams.data && teams.data.length === 0 ? t("users.noTeamsInDepartment") : t("common.noResults")}
            />
          )}
        />
      )}
    </div>
  );
}
