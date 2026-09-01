import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ReportsRangeParams } from "../reports.types";

export const GLOBAL_REPORT_PARAM_KEYS = ["from", "to", "departmentId", "branchId"] as const;
export type GlobalReportParamKey = (typeof GLOBAL_REPORT_PARAM_KEYS)[number];

/**
 * Extracts only global report filter parameters (`from`, `to`, `departmentId`, `branchId`)
 * from a URLSearchParams object.
 */
export function extractGlobalReportParams(searchParams: URLSearchParams): ReportsRangeParams {
  const result: ReportsRangeParams = {};
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const departmentId = searchParams.get("departmentId");
  const branchId = searchParams.get("branchId");

  if (from) result.from = from;
  if (to) result.to = to;
  if (departmentId) result.departmentId = departmentId;
  if (branchId) result.branchId = branchId;

  return result;
}

/**
 * Builds a URL search string containing only global report filter parameters.
 */
export function buildGlobalSearchString(searchParams: URLSearchParams): string {
  const next = new URLSearchParams();
  for (const key of GLOBAL_REPORT_PARAM_KEYS) {
    const val = searchParams.get(key);
    if (val) {
      next.set(key, val);
    }
  }
  const str = next.toString();
  return str ? `?${str}` : "";
}

/**
 * Creates a navigation target object that points to `pathname` while preserving
 * ONLY global report parameters (`from`, `to`, `departmentId`, `branchId`).
 */
export function createReportNavTarget(pathname: string, currentSearchParams: URLSearchParams) {
  const next = new URLSearchParams();
  for (const key of GLOBAL_REPORT_PARAM_KEYS) {
    const val = currentSearchParams.get(key);
    if (val) {
      next.set(key, val);
    }
  }
  const search = next.toString();
  return {
    pathname,
    search: search ? `?${search}` : "",
  };
}

export function useReportsRangeParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rangeParams = useMemo<ReportsRangeParams>(
    () => extractGlobalReportParams(searchParams),
    [searchParams]
  );

  const setRangeParams = useCallback(
    (updates: Partial<ReportsRangeParams>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          for (const key of GLOBAL_REPORT_PARAM_KEYS) {
            const val = updates[key];
            if (val === undefined) {
              // keep existing
            } else if (val === null || val === "") {
              next.delete(key);
            } else {
              next.set(key, val);
            }
          }

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const resetRangeParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of GLOBAL_REPORT_PARAM_KEYS) {
          next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const getReportLink = useCallback(
    (pathname: string) => createReportNavTarget(pathname, searchParams),
    [searchParams]
  );

  return {
    rangeParams,
    searchParams,
    setRangeParams,
    resetRangeParams,
    getReportLink,
  };
}
