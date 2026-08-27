import { cn } from "@/lib/utils";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

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

export function DataTableSkeleton({
  columns,
  rowCount = 5,
  className,
  containerClassName,
}: DataTableSkeletonProps) {
  const columnConfigs: DataTableSkeletonColumn[] = Array.isArray(columns)
    ? columns
    : Array.from({ length: columns }).map(() => ({ width: "w-auto" }));

  return (
    <TableContainer className={containerClassName}>
      <Table className={className}>
        <TableHeader>
          <TableRow>
            {columnConfigs.map((col, index) => (
              <TableHead
                key={index}
                className={cn(col.className, col.width)}
              >
                {col.header ? (
                  col.header
                ) : (
                  <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {columnConfigs.map((col, colIndex) => (
                <TableCell
                  key={colIndex}
                  className={cn(col.className, col.width)}
                >
                  <div
                    className={cn(
                      "h-4 animate-pulse rounded bg-muted/80",
                      colIndex === 0 ? "w-20" : colIndex === 1 ? "w-48" : "w-24"
                    )}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
