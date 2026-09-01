import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/shared/skeleton/table-skeleton";

export interface DataTableSkeletonColumn {
  header?: string;
  width?: string;
  className?: string;
}

export interface DataTableSkeletonProps {
  columns: DataTableSkeletonColumn[] | number;
  rowCount?: number;
  className?: string;
  containerClassName?: string;
}

/**
 * Table loading skeleton for use *inside* a {@link DataTableSurface} (the shared
 * {@link DataTable} and the list pages already provide the bordered container),
 * so this renders the header + rows flush with no border of its own.
 *
 * Thin wrapper over the generic {@link TableSkeleton}.
 */
export function DataTableSkeleton({
  columns,
  rowCount = 5,
  className,
  containerClassName,
}: DataTableSkeletonProps) {
  const count = Array.isArray(columns) ? columns.length : columns;
  const columnWidths = Array.isArray(columns)
    ? columns.map((col) => col.width)
    : undefined;

  return (
    <TableSkeleton
      surface={false}
      columns={count}
      rows={rowCount}
      columnWidths={columnWidths}
      minWidth="w-full"
      className={cn(containerClassName, className)}
    />
  );
}
