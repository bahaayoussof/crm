import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type PaginationState, type Updater } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table/data-table-pagination";
import { AssigneeCell } from "@/components/shared/data-table/assignee-cell";
import { formatArticleDate } from "./knowledge-article-format";
import { ArticleStatusBadge } from "./knowledge-base-ui";
import type { KnowledgeArticleListItem, KnowledgeArticleStatus } from "./knowledge-article.types";

interface KnowledgeArticleTableProps {
  articles: KnowledgeArticleListItem[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
}

const columnClasses: Record<string, string> = {
  title: "w-[36%]",
  category: "w-[16%]",
  status: "w-[120px]",
  author: "w-[160px]",
  updatedAt: "w-[160px]",
};

export function KnowledgeArticleTable({
  articles,
  page,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
}: KnowledgeArticleTableProps) {
  const { t, i18n } = useTranslation();
  const columns = useMemo<ColumnDef<KnowledgeArticleListItem>[]>(
    () => [
      {
        id: "title",
        accessorKey: "title",
        header: t("knowledgeBase.columns.title"),
        cell: ({ row }) => (
          <Link
            className="line-clamp-2 rounded-sm font-medium text-[13px] text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={`/knowledge-base/${row.original.id}`}
            title={row.original.title}
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: "category",
        accessorKey: "category",
        header: t("knowledgeBase.columns.category"),
        cell: ({ getValue }) => {
          const category = getValue<string | null>();
          return category ? (
            <span
              className="block truncate text-xs text-foreground font-normal"
              dir="auto"
              title={category}
            >
              {category}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("common.notProvided")}</span>
          );
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("knowledgeBase.columns.status"),
        cell: ({ getValue }) => <ArticleStatusBadge status={getValue<KnowledgeArticleStatus>()} />,
      },
      {
        id: "author",
        accessorKey: "createdBy.name",
        header: t("knowledgeBase.columns.author"),
        cell: ({ row }) => (
          <AssigneeCell
            name={row.original.createdBy?.name}
            unassignedLabel={t("knowledgeBase.authorUnknown")}
          />
        ),
      },
      {
        id: "updatedAt",
        accessorKey: "updatedAt",
        header: t("knowledgeBase.columns.updated"),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatArticleDate(getValue<string>(), i18n.language)}
          </span>
        ),
      },
    ],
    [i18n.language, t]
  );

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: page - 1, pageSize }),
    [page, pageSize]
  );

  const table = useReactTable({
    data: articles,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (article) => article.id,
    manualPagination: true,
    pageCount,
    state: { pagination },
    onPaginationChange: (updater) => handlePaginationChange(updater, pagination, onPageChange),
  });

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <Table className="w-full">
          <colgroup>
            {table.getAllLeafColumns().map((column) => (
              <col key={column.id} className={columnClasses[column.id] ?? ""} />
            ))}
          </colgroup>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y divide-border-subtle bg-table-background md:hidden">
        {articles.map((article) => (
          <Link
            className="block p-4 transition-colors hover:bg-table-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            key={article.id}
            to={`/knowledge-base/${article.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-medium text-[13px] text-foreground" dir="auto">
                {article.title}
              </p>
              <ArticleStatusBadge status={article.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground" dir="auto">
              {article.category ?? t("common.notProvided")}
            </p>
            <p className="mt-3 border-t border-border-subtle pt-2 text-xs text-muted-foreground">
              {t("knowledgeBase.columns.updated")}:{" "}
              <bdi dir="ltr">{formatArticleDate(article.updatedAt, i18n.language)}</bdi>
              <span className="mx-1">·</span>
              <span dir="auto">{article.createdBy.name}</span>
            </p>
          </Link>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="border-t border-table-border bg-table-background px-3.5 py-2">
          <DataTablePagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            totalCount={totalCount}
            canPreviousPage={table.getCanPreviousPage()}
            canNextPage={table.getCanNextPage()}
            onPreviousPage={() => table.previousPage()}
            onNextPage={() => table.nextPage()}
            ariaLabel={t("knowledgeBase.pagination")}
          />
        </div>
      )}
    </>
  );
}

function handlePaginationChange(
  updater: Updater<PaginationState>,
  current: PaginationState,
  onPageChange: (page: number) => void
) {
  const next = typeof updater === "function" ? updater(current) : updater;
  if (next.pageIndex !== current.pageIndex) onPageChange(next.pageIndex + 1);
}
