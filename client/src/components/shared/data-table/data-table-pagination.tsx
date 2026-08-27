import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface DataTablePaginationProps {
  page: number;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  totalCount?: number;
  pageSize?: number;
  ariaLabel?: string;
  className?: string;
}

export function DataTablePagination({
  page,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
  totalCount,
  pageSize = 20,
  ariaLabel,
  className,
}: DataTablePaginationProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";

  if (pageCount <= 1 && totalCount === undefined) {
    return null;
  }

  // Calculate range if totalCount provided
  const from = totalCount !== undefined && totalCount > 0 ? (page - 1) * pageSize + 1 : undefined;
  const to =
    totalCount !== undefined && totalCount > 0
      ? Math.min(page * pageSize, totalCount)
      : undefined;

  return (
    <nav
      className={cn(
        "flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between text-[11px] text-muted-foreground",
        className
      )}
      aria-label={ariaLabel ?? t("common.pagination", "Pagination")}
    >
      <div>
        {from !== undefined && to !== undefined && totalCount !== undefined ? (
          <span>
            {isRtl
              ? `عرض ${from}–${to} من ${totalCount}`
              : `Showing ${from}–${to} of ${totalCount}`}
          </span>
        ) : (
          <span>
            {t("tickets.page", { page, total: pageCount })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:ms-auto">
        <button
          type="button"
          className="inline-flex h-7.5 items-center justify-center gap-1 rounded-md border border-border bg-surface px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-surface-hover hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canPreviousPage}
          onClick={onPreviousPage}
          aria-label={t("common.previous")}
        >
          {isRtl ? (
            <ChevronRight className="size-3" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-3" aria-hidden="true" />
          )}
          <span>{t("common.previous")}</span>
        </button>

        <span className="px-1.5 font-medium text-foreground text-[11px]">
          {page} / {Math.max(1, pageCount)}
        </span>

        <button
          type="button"
          className="inline-flex h-7.5 items-center justify-center gap-1 rounded-md border border-border bg-surface px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-surface-hover hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canNextPage}
          onClick={onNextPage}
          aria-label={t("common.next")}
        >
          <span>{t("common.next")}</span>
          {isRtl ? (
            <ChevronLeft className="size-3" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-3" aria-hidden="true" />
          )}
        </button>
      </div>
    </nav>
  );
}
