import { useMemo } from "react";

import { useTranslation } from "react-i18next";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  DataTableSurface,
  DataTableToolbar,
  DataTableSearch,
  DataTablePagination,
  DataTableEmptyRow,
} from "@/components/shared/data-table";
import type { BreakdownItem } from "../../reports.types";
import type { DimensionMeta } from "./breakdown-config";

export interface BreakdownTableProps {
  items: BreakdownItem[];
  config: DimensionMeta;
  search: string;
  onSearchChange: (search: string) => void;
  page: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export function BreakdownTable({
  items,
  config,
  search,
  onSearchChange,
  page,
  pageSize = 10,
  onPageChange,
}: BreakdownTableProps) {
  const { t, i18n } = useTranslation();

  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language]
  );

  const filteredItems = useMemo(() => {
    if (!config.searchable || !search.trim()) return items;
    const query = search.trim().toLowerCase();
    return items.filter((item) => (item.label ?? item.key).toLowerCase().includes(query));
  }, [items, config.searchable, search]);

  const totalCount = filteredItems.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  const paginatedItems = useMemo(() => {
    if (!config.paginated) return filteredItems;
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, config.paginated, page, pageSize]);

  return (
    <DataTableSurface className="min-w-0">
      {config.searchable && (
        <DataTableToolbar
          search={
            <DataTableSearch
              value={search}
              onChange={onSearchChange}
              placeholder={t("reports.categories.searchPlaceholder", {
                defaultValue: "Search categories…",
              })}
              id="breakdown-category-search"
              ariaLabel={t("reports.categories.searchPlaceholder", {
                defaultValue: "Search categories…",
              })}
            />
          }
        />
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-[25rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t(config.labelKey)}</TableHead>
              <TableHead className="w-20 text-end">{t("reports.legend.created")}</TableHead>
              <TableHead className="w-20 text-end">{t("reports.legend.resolved")}</TableHead>
              <TableHead className="w-24 text-end">{t("reports.sla.complianceShort", { defaultValue: "Share" })}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <DataTableEmptyRow
                colSpan={4}
                message={
                  search.trim()
                    ? t("reports.emptyCategoriesMatch", {
                        defaultValue: "No categories match “{{search}}”.",
                        search,
                      })
                    : t("reports.emptyStatus", {
                        defaultValue: "No data for this range.",
                      })
                }
              />
            ) : (
              paginatedItems.map((item) => (
                <TableRow key={item.key}>
                  <TableCell className="font-medium text-table-foreground">
                    <span className="block truncate" title={item.label ?? item.key}>
                      {item.label ?? item.key}
                    </span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-table-foreground">
                    {nf.format(item.created)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-table-foreground">
                    {nf.format(item.resolved)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums font-medium text-table-foreground">
                    {nf.format(item.share)}%
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {config.paginated && totalCount > 0 && (
        <div className="border-t border-table-border bg-table-background px-3.5 py-2">
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            pageCount={pageCount}
            totalCount={totalCount}
            canPreviousPage={page > 1}
            canNextPage={page < pageCount}
            onPreviousPage={() => onPageChange(page - 1)}
            onNextPage={() => onPageChange(page + 1)}
          />
        </div>
      )}
    </DataTableSurface>
  );
}
