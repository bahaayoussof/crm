import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type PaginationState, type Updater } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatQuickReplyDate } from "./quick-reply-format";
import { useDeleteQuickReply } from "./quick-reply-hooks";
import { PencilIcon, SpinnerIcon, TrashIcon } from "./quick-reply-icons";
import type { QuickReply } from "./quick-reply.types";

interface QuickReplyTableProps {
  quickReplies: QuickReply[];
  page: number;
  pageSize: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

const ICON_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors " +
  "hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60";
const ICON_BUTTON_DANGER =
  "inline-flex size-8 items-center justify-center rounded-lg border border-danger-subtle text-danger-foreground transition-colors " +
  "hover:bg-danger-subtle/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const columnClasses: Record<string, string> = {
  title: "w-[24%]",
  body: "w-auto",
  updatedAt: "w-[184px]",
  actions: "w-[116px]",
};

export function QuickReplyTable({ quickReplies, page, pageSize, pageCount, onPageChange }: QuickReplyTableProps) {
  const { t, i18n } = useTranslation();

  const columns = useMemo<ColumnDef<QuickReply>[]>(() => [
    {
      id: "title",
      accessorKey: "title",
      header: () => t("quickReplies.columns.title"),
      cell: ({ row }) => <Link
        className="block min-w-0 rounded-sm break-words font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        dir="auto"
        title={row.original.title}
        to={`/quick-replies/${row.original.id}/edit`}
      >{row.original.title}</Link>,
    },
    {
      id: "body",
      accessorKey: "body",
      header: () => t("quickReplies.columns.body"),
      cell: ({ getValue }) => <p
        className="line-clamp-2 whitespace-pre-line break-words [overflow-wrap:anywhere] text-muted-foreground"
        dir="auto"
        title={getValue<string>()}
      >{getValue<string>()}</p>,
    },
    {
      id: "updatedAt",
      accessorKey: "updatedAt",
      header: () => t("quickReplies.columns.updated"),
      cell: ({ getValue }) => <span className="whitespace-nowrap text-xs text-muted-foreground"><bdi dir="ltr">{formatQuickReplyDate(getValue<string>(), i18n.language)}</bdi></span>,
    },
    {
      id: "actions",
      header: () => <span className="block text-end">{t("quickReplies.columns.actions")}</span>,
      cell: ({ row }) => <RowActions quickReply={row.original} />,
    },
  ], [i18n.language, t]);

  const pagination = useMemo<PaginationState>(() => ({ pageIndex: page - 1, pageSize }), [page, pageSize]);
  const table = useReactTable({
    data: quickReplies,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (quickReply) => quickReply.id,
    manualPagination: true,
    pageCount,
    state: { pagination },
    onPaginationChange: (updater) => handlePaginationChange(updater, pagination, onPageChange),
  });

  return <>
    <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-subtle md:block">
      <table className="w-full min-w-[52rem] table-fixed text-start text-sm">
        <colgroup>
          {table.getAllLeafColumns().map((column) => <col key={column.id} className={columnClasses[column.id] ?? ""} />)}
        </colgroup>
        <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
          {table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th
            className={`px-4 py-3 font-semibold ${header.column.id === "actions" ? "text-end" : "text-start"}`}
            scope="col"
            key={header.id}
          >{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {table.getRowModel().rows.map((row) => <tr className="align-top transition-colors hover:bg-surface-hover" key={row.id}>{row.getVisibleCells().map((cell) => <td
            className={`px-4 py-3 ${cell.column.id === "actions" ? "text-end" : ""}`}
            key={cell.id}
          >{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
        </tbody>
      </table>
    </div>

    <div className="divide-y divide-border-subtle rounded-xl border border-border bg-surface shadow-subtle md:hidden">
      {quickReplies.map((quickReply) => <div className="p-4" key={quickReply.id}>
        <Link
          className="block min-w-0 rounded-sm break-words font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          dir="auto"
          title={quickReply.title}
          to={`/quick-replies/${quickReply.id}/edit`}
        >{quickReply.title}</Link>
        <p className="mt-1.5 line-clamp-3 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm text-muted-foreground" dir="auto" title={quickReply.body}>{quickReply.body}</p>
        <p className="mt-2.5 border-t border-border-subtle pt-2 text-xs text-muted-foreground">
          {t("quickReplies.columns.updated")}: <bdi dir="ltr">{formatQuickReplyDate(quickReply.updatedAt, i18n.language)}</bdi>
          <span className="mx-1">·</span>
          <span dir="auto">{quickReply.createdBy.name}</span>
        </p>
        <div className="mt-2.5 flex justify-end"><RowActions quickReply={quickReply} /></div>
      </div>)}
    </div>

    {pageCount > 1 && <nav className="mt-6 flex items-center justify-between gap-3" aria-label={t("quickReplies.pagination")}>
      <button className="button-secondary" type="button" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>{t("common.previous")}</button>
      <span className="text-center text-xs font-medium text-muted-foreground">{t("quickReplies.page", { page, total: pageCount })}</span>
      <button className="button-secondary" type="button" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>{t("common.next")}</button>
    </nav>}
  </>;
}

function RowActions({ quickReply }: { quickReply: QuickReply }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteQuickReply();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const cancel = () => {
    if (remove.isPending) return;
    setConfirming(false);
    setError(null);
    deleteRef.current?.focus();
  };

  const onConfirm = async () => {
    setError(null);
    try {
      await remove.mutateAsync(quickReply.id);
    } catch {
      setError(t("quickReplies.deleteError"));
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex items-center gap-1.5"
      onKeyDown={(event) => { if (event.key === "Escape" && confirming) { event.stopPropagation(); cancel(); } }}
      onBlur={(event) => {
        if (!confirming || remove.isPending) return;
        if (!(event.relatedTarget instanceof Node) || !wrapperRef.current?.contains(event.relatedTarget)) {
          setConfirming(false);
          setError(null);
        }
      }}
    >
      <Link
        className={ICON_BUTTON}
        to={`/quick-replies/${quickReply.id}/edit`}
        aria-label={t("quickReplies.editAction")}
        title={t("quickReplies.editAction")}
      ><PencilIcon /></Link>
      <button
        ref={deleteRef}
        type="button"
        className={ICON_BUTTON_DANGER}
        aria-label={t("quickReplies.deleteAction")}
        title={t("quickReplies.deleteAction")}
        aria-haspopup="dialog"
        aria-expanded={confirming}
        onClick={() => { setError(null); setConfirming(true); }}
      ><TrashIcon /></button>

      {confirming && (
        <div
          role="dialog"
          aria-label={t("quickReplies.deleteConfirmLabel", { title: quickReply.title })}
          className="absolute end-0 top-full z-20 mt-1 w-56 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-surface p-3 text-start shadow-elevated"
        >
          <p className="text-xs leading-5 text-foreground" dir="auto">{t("quickReplies.deleteConfirmLabel", { title: quickReply.title })}</p>
          {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
          <div className="mt-2.5 flex justify-end gap-2">
            <button type="button" className="button-ghost min-h-8 px-2.5 py-1 text-xs" disabled={remove.isPending} onClick={cancel}>{t("common.cancel")}</button>
            <button ref={confirmRef} type="button" className="button-danger min-h-8 w-auto gap-1.5 px-2.5 py-1 text-xs" disabled={remove.isPending} onClick={onConfirm}>
              {remove.isPending ? <><SpinnerIcon className="size-3.5" />{t("quickReplies.deleting")}</> : (error ? t("common.retry") : t("quickReplies.confirmDelete"))}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function handlePaginationChange(updater: Updater<PaginationState>, current: PaginationState, onPageChange: (page: number) => void) {
  const next = typeof updater === "function" ? updater(current) : updater;
  if (next.pageIndex !== current.pageIndex) onPageChange(next.pageIndex + 1);
}
