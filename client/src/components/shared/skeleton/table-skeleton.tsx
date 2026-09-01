import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DataTableSurface } from "@/components/shared/data-table/data-table-surface";
import { Skeleton } from "./skeleton";

export interface TableSkeletonProps {
  /** Number of columns to mimic. */
  columns?: number;
  /** Number of body rows to mimic. */
  rows?: number;
  /**
   * Optional per-column width hint classes (Tailwind, e.g. `"w-[22%]"`).
   * Rendered as a `<colgroup>` so the skeleton keeps the loaded table's
   * column rhythm and nothing jumps on load.
   */
  columnWidths?: Array<string | undefined>;
  /** Render the toolbar shell (search + filter placeholders live here). */
  toolbar?: boolean;
  /** Render a search-input placeholder in the toolbar (implies `toolbar`). */
  search?: boolean;
  /** Render a filter-trigger placeholder in the toolbar (implies `toolbar`). */
  filters?: boolean;
  /** Render the bordered pagination footer shell. */
  pagination?: boolean;
  /** Wrap everything in the shared bordered `DataTableSurface`. Default `true`. */
  surface?: boolean;
  /** Min-width class for the inner table (horizontal-scroll target). */
  minWidth?: string;
  className?: string;
}

const CELL_WIDTHS = ["w-28", "w-40", "w-20", "w-24", "w-24", "w-16", "w-24", "w-20"];

/**
 * Loading skeleton that reproduces the shared {@link DataTable} layout — same
 * outer container, toolbar area, header shape, row height and pagination area —
 * so the switch from loading to loaded never shifts the layout.
 *
 * Generic on purpose: configure it with counts + width hints, never with
 * feature-specific flags.
 */
export function TableSkeleton({
  columns = 6,
  rows = 5,
  columnWidths,
  toolbar,
  search,
  filters,
  pagination,
  surface = true,
  minWidth = "min-w-[52rem]",
  className,
}: TableSkeletonProps) {
  const showToolbar = toolbar || search || filters;
  const cols = Array.from({ length: Math.max(1, columns) });

  const body = (
    <>
      {showToolbar && (
        <div className="flex flex-col gap-2.5 border-b border-table-border bg-table-background px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8.5 w-72 max-w-full rounded-lg" />
          {(filters || toolbar) && (
            <div className="flex items-center gap-2 sm:ms-auto">
              <Skeleton className="h-8.5 w-24 rounded-lg" />
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table className={cn("w-full", minWidth)}>
          {columnWidths && columnWidths.length > 0 && (
            <colgroup>
              {cols.map((_, index) => (
                <col key={index} className={columnWidths[index] ?? ""} />
              ))}
            </colgroup>
          )}
          <TableHeader>
            <TableRow>
              {cols.map((_, index) => (
                <TableHead key={index}>
                  <Skeleton className="h-3 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: Math.max(1, rows) }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {cols.map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <Skeleton
                      className={cn("h-4", CELL_WIDTHS[colIndex % CELL_WIDTHS.length])}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between gap-2 border-t border-table-border bg-table-background px-3.5 py-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7.5 w-40 rounded-md" />
        </div>
      )}
    </>
  );

  if (surface) {
    return <DataTableSurface className={className}>{body}</DataTableSurface>;
  }
  return <div className={cn("overflow-hidden", className)}>{body}</div>;
}
