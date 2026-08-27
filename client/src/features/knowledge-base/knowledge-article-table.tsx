import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type PaginationState, type Updater } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatArticleDate } from "./knowledge-article-format";
import { ArticleStatusBadge } from "./knowledge-base-ui";
import type { KnowledgeArticleListItem } from "./knowledge-article.types";

interface KnowledgeArticleTableProps {
  articles: KnowledgeArticleListItem[];
  page: number;
  pageSize: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

const columnClasses: Record<string, string> = {
  title: "w-[40%]",
  category: "hidden lg:table-cell w-[16%]",
  status: "w-[12%]",
  updatedAt: "w-[16%]",
  author: "hidden xl:table-cell w-[16%]",
};

export function KnowledgeArticleTable({ articles, page, pageSize, pageCount, onPageChange }: KnowledgeArticleTableProps) {
  const { t, i18n } = useTranslation();
  const columns = useMemo<ColumnDef<KnowledgeArticleListItem>[]>(() => [
    {
      id: "title",
      accessorKey: "title",
      header: t("knowledgeBase.columns.title"),
      cell: ({ row }) => <Link
        className="line-clamp-2 rounded-sm font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        dir="auto"
        title={row.original.title}
        to={`/knowledge-base/${row.original.id}`}
      >{row.original.title}</Link>,
    },
    {
      id: "category",
      accessorKey: "category",
      header: t("knowledgeBase.columns.category"),
      cell: ({ getValue }) => {
        const category = getValue<string | null>();
        return category
          ? <span className="block truncate text-foreground font-medium" dir="auto" title={category}>{category}</span>
          : <span className="text-muted-foreground">{t("common.notProvided")}</span>;
      },
    },
    {
      id: "status",
      accessorKey: "status",
      header: t("knowledgeBase.columns.status"),
      cell: ({ row }) => <ArticleStatusBadge status={row.original.status} />,
    },
    {
      id: "updatedAt",
      accessorKey: "updatedAt",
      header: t("knowledgeBase.columns.updated"),
      cell: ({ getValue }) => <span className="whitespace-nowrap text-xs text-muted-foreground"><bdi dir="ltr">{formatArticleDate(getValue<string>(), i18n.language)}</bdi></span>,
    },
    {
      id: "author",
      accessorFn: (row) => row.createdBy.name,
      header: t("knowledgeBase.columns.author"),
      cell: ({ row }) => <span className="block truncate text-xs text-muted-foreground" dir="auto" title={row.original.createdBy.name}>{row.original.createdBy.name}</span>,
    },
  ], [i18n.language, t]);

  const pagination = useMemo<PaginationState>(() => ({ pageIndex: page - 1, pageSize }), [page, pageSize]);
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

  return <>
    <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-subtle md:block">
      <table className="w-full min-w-[44rem] table-fixed text-start text-sm">
        <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
          {table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th className={`px-4 py-3 text-start font-semibold ${columnClasses[header.column.id] ?? ""}`} scope="col" key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {table.getRowModel().rows.map((row) => <tr className="align-top transition-colors hover:bg-surface-hover" key={row.id}>{row.getVisibleCells().map((cell) => <td className={`px-4 py-3.5 ${columnClasses[cell.column.id] ?? ""}`} key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
    <div className="divide-y divide-border-subtle rounded-xl border border-border bg-surface shadow-subtle md:hidden">
      {articles.map((article) => <Link
        className="block p-4 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
        key={article.id}
        to={`/knowledge-base/${article.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 break-words font-semibold text-foreground" dir="auto">{article.title}</p>
          <ArticleStatusBadge status={article.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground" dir="auto">{article.category ?? t("common.notProvided")}</p>
        <p className="mt-3 border-t border-border-subtle pt-2 text-xs text-muted-foreground">
          {t("knowledgeBase.columns.updated")}: <bdi dir="ltr">{formatArticleDate(article.updatedAt, i18n.language)}</bdi>
          <span className="mx-1">·</span>
          <span dir="auto">{article.createdBy.name}</span>
        </p>
      </Link>)}
    </div>
    {pageCount > 1 && <nav className="mt-6 flex items-center justify-between gap-3" aria-label={t("knowledgeBase.pagination")}>
      <button className="button-secondary" type="button" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>{t("common.previous")}</button>
      <span className="text-center text-xs font-medium text-muted-foreground">{t("knowledgeBase.page", { page, total: pageCount })}</span>
      <button className="button-secondary" type="button" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>{t("common.next")}</button>
    </nav>}
  </>;
}

function handlePaginationChange(updater: Updater<PaginationState>, current: PaginationState, onPageChange: (page: number) => void) {
  const next = typeof updater === "function" ? updater(current) : updater;
  if (next.pageIndex !== current.pageIndex) onPageChange(next.pageIndex + 1);
}
