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
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  getRowId?: (item: TData) => string;
  toolbar?: ReactNode;
  pagination?: DataTablePaginationConfig;
  isLoading?: boolean;
  loadingRowCount?: number;
  isError?: boolean;
  errorState?: ReactNode;
  emptyMessage?: ReactNode;
  renderMobileCard?: (item: TData, index: number) => ReactNode;
  columnClasses?: Record<string, string> | ((columnId: string) => string);
  minWidth?: string;
  meta?: TableMeta<TData>;
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
  renderMobileCard,
  columnClasses,
  minWidth = "min-w-[52rem]",
  meta,
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

  return (
    <DataTableSurface className={className}>
      {/* Optional Toolbar */}
      {toolbar}

      {/* Loading State */}
      {isLoading ? (
        <DataTableSkeleton
          columns={columns.length}
          rowCount={loadingRowCount}
        />
      ) : isError ? (
        /* Error State */
        <div className="p-6">{errorState}</div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table className={minWidth}>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const colClass = getColClass(header.column.id);
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(colClass)}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <DataTableEmptyRow
                    colSpan={table.getVisibleLeafColumns().length}
                    message={emptyMessage}
                  />
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => {
                        const colClass = getColClass(cell.column.id);
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(colClass)}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List View (if provided) */}
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

      {/* Pagination Footer */}
      {pagination && (pagination.pageCount > 1 || (pagination.totalCount !== undefined && pagination.totalCount > (pagination.pageSize ?? 20))) && (
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
    </DataTableSurface>
  );
}
