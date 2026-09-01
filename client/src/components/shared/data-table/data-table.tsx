import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Updater,
  type TableMeta,
} from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DataTableSurface } from "./data-table-surface";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableSkeleton } from "./data-table-skeleton";
import { DataTableEmptyRow } from "./data-table-empty";
import { cn } from "@/lib/utils";

export interface DataTablePaginationConfig {
  page: number;
  pageSize?: number;
  pageCount: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  ariaLabel?: string;
  /**
   * Render the footer even on a single page (e.g. to keep a "Showing 1–N of N"
   * result count visible). Default: footer only shows when there is more than
   * one page.
   */
  alwaysShow?: boolean;
}

type ClassResolver = Record<string, string> | ((columnId: string) => string);

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  getRowId?: (item: TData) => string;
  /** Toolbar content — rendered flush inside the same bordered surface. */
  toolbar?: ReactNode;
  pagination?: DataTablePaginationConfig;
  isLoading?: boolean;
  loadingRowCount?: number;
  isError?: boolean;
  errorState?: ReactNode;
  /** Shown in the table body when there are no rows (string or custom node). */
  emptyMessage?: ReactNode;
  /** Optional action rendered under `emptyMessage`. */
  emptyAction?: ReactNode;
  renderMobileCard?: (item: TData, index: number) => ReactNode;
  /** Per-column `<col>` width hints (Tailwind classes) — drives a `<colgroup>`. */
  columnWidths?: Record<string, string>;
  /** Per-column extra classes applied to both the header cell and the body cell. */
  columnClasses?: ClassResolver;
  /** Extra class(es) for every body `<tr>`. */
  rowClassName?: string | ((item: TData, index: number) => string);
  /** Min-width (horizontal-scroll target) for the inner table. */
  minWidth?: string;
  meta?: TableMeta<TData>;
  /** Set `false` to render without the bordered surface (caller provides it). */
  surface?: boolean;
  className?: string;
}

export function DataTable<TData>({
  data,
  columns,
  getRowId,
  toolbar,
  pagination,
  isLoading,
  loadingRowCount = 5,
  isError,
  errorState,
  emptyMessage,
  emptyAction,
  renderMobileCard,
  columnWidths,
  columnClasses,
  rowClassName,
  minWidth = "min-w-[52rem]",
  meta,
  surface = true,
  className,
}: DataTableProps<TData>) {
  const paginationState = useMemo<PaginationState>(
    () => ({
      pageIndex: (pagination?.page ?? 1) - 1,
      pageSize: pagination?.pageSize ?? 20,
    }),
    [pagination?.page, pagination?.pageSize]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualPagination: Boolean(pagination),
    pageCount: pagination?.pageCount ?? -1,
    state: {
      pagination: pagination ? paginationState : undefined,
    },
    meta,
    onPaginationChange: (updater: Updater<PaginationState>) => {
      if (!pagination?.onPageChange) return;
      const next = typeof updater === "function" ? updater(paginationState) : updater;
      if (next.pageIndex !== paginationState.pageIndex) {
        pagination.onPageChange(next.pageIndex + 1);
      }
    },
  });

  const getColClass = (colId: string) => {
    if (!columnClasses) return "";
    if (typeof columnClasses === "function") return columnClasses(colId);
    return columnClasses[colId] ?? "";
  };
  const getRowClass = (item: TData, index: number) =>
    typeof rowClassName === "function" ? rowClassName(item, index) : rowClassName;

  const leafColumns = table.getAllLeafColumns();

  const showPagination =
    pagination &&
    (pagination.alwaysShow ||
      pagination.pageCount > 1 ||
      (pagination.totalCount !== undefined &&
        pagination.totalCount > (pagination.pageSize ?? 20)));

  const content = (
    <>
      {toolbar}

      {isLoading ? (
        <DataTableSkeleton
          columns={
            columnWidths
              ? leafColumns.map((col) => ({ width: columnWidths[col.id] }))
              : columns.length
          }
          rowCount={loadingRowCount}
        />
      ) : isError ? (
        <div className="p-6">{errorState}</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <Table className={cn(minWidth, columnWidths && "w-full")}>
              {columnWidths && (
                <colgroup>
                  {leafColumns.map((col) => (
                    <col key={col.id} className={columnWidths[col.id] ?? ""} />
                  ))}
                </colgroup>
              )}
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(getColClass(header.column.id))}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <DataTableEmptyRow
                    colSpan={table.getVisibleLeafColumns().length}
                    message={emptyMessage}
                    action={emptyAction}
                  />
                ) : (
                  table.getRowModel().rows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={cn(getRowClass(row.original, index))}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(getColClass(cell.column.id))}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          {renderMobileCard && (
            <div className="divide-y divide-border-subtle bg-table-background md:hidden">
              {data.length === 0 ? (
                typeof emptyMessage === "string" ? (
                  <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                    {emptyMessage}
                  </p>
                ) : (
                  <div className="p-4">{emptyMessage}</div>
                )
              ) : (
                data.map((item, index) => (
                  <div key={getRowId ? getRowId(item) : index}>
                    {renderMobileCard(item, index)}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {showPagination && (
        <div className="border-t border-table-border bg-table-background px-3.5 py-2">
          <DataTablePagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            canPreviousPage={table.getCanPreviousPage()}
            canNextPage={table.getCanNextPage()}
            onPreviousPage={() => table.previousPage()}
            onNextPage={() => table.nextPage()}
            ariaLabel={pagination.ariaLabel}
          />
        </div>
      )}
    </>
  );

  if (surface) {
    return <DataTableSurface className={className}>{content}</DataTableSurface>;
  }
  return <div className={className}>{content}</div>;
}
