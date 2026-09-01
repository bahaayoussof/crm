import { type ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "@/components/shared/data-table";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { formatQuickReplyDate } from "./quick-reply-format";
import { useDeleteQuickReply } from "./quick-reply-hooks";
import { PencilIcon, SpinnerIcon, TrashIcon } from "./quick-reply-icons";
import type { QuickReply } from "./quick-reply.types";

interface QuickReplyTableProps {
  quickReplies: QuickReply[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
}

const COLUMN_WIDTHS: Record<string, string> = {
  title: "w-[24%]",
  body: "w-auto",
  updatedAt: "w-[184px]",
  actions: "w-[116px]",
};

const COLUMN_CLASSES: Record<string, string> = {
  actions: "text-end",
};

export function QuickReplyTable({
  quickReplies,
  page,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
}: QuickReplyTableProps) {
  const { t, i18n } = useTranslation();

  const columns = useMemo<ColumnDef<QuickReply>[]>(
    () => [
      {
        id: "title",
        accessorKey: "title",
        header: () => t("quickReplies.columns.title"),
        cell: ({ row }) => (
          <Link
            className="block min-w-0 rounded-sm break-words font-semibold text-foreground line-clamp-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            dir="auto"
            title={row.original.title}
            to={`/quick-replies/${row.original.id}/edit`}
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: "body",
        accessorKey: "body",
        header: () => t("quickReplies.columns.body"),
        cell: ({ getValue }) => (
          <p
            className="line-clamp-2 whitespace-pre-line break-words [overflow-wrap:anywhere] text-muted-foreground"
            dir="auto"
            title={getValue<string>()}
          >
            {getValue<string>()}
          </p>
        ),
      },
      {
        id: "updatedAt",
        accessorKey: "updatedAt",
        header: () => t("quickReplies.columns.updated"),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            <bdi dir="ltr">{formatQuickReplyDate(getValue<string>(), i18n.language)}</bdi>
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="block text-end">{t("quickReplies.columns.actions")}</span>,
        cell: ({ row }) => <RowActions quickReply={row.original} />,
      },
    ],
    [i18n.language, t]
  );

  return (
    <DataTable
      surface={false}
      data={quickReplies}
      columns={columns}
      getRowId={(quickReply) => quickReply.id}
      columnWidths={COLUMN_WIDTHS}
      columnClasses={COLUMN_CLASSES}
      rowClassName="align-top"
      pagination={{
        page,
        pageSize,
        pageCount,
        totalCount,
        onPageChange,
        ariaLabel: t("quickReplies.pagination"),
      }}
      renderMobileCard={(quickReply) => (
        <div className="p-4">
          <Link
            className="block min-w-0 rounded-sm break-words font-semibold text-foreground line-clamp-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            dir="auto"
            title={quickReply.title}
            to={`/quick-replies/${quickReply.id}/edit`}
          >
            {quickReply.title}
          </Link>
          <p
            className="mt-1.5 line-clamp-3 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm text-muted-foreground"
            dir="auto"
            title={quickReply.body}
          >
            {quickReply.body}
          </p>
          <p className="mt-2.5 border-t border-border-subtle pt-2 text-xs text-muted-foreground">
            {t("quickReplies.columns.updated")}:{" "}
            <bdi dir="ltr">{formatQuickReplyDate(quickReply.updatedAt, i18n.language)}</bdi>
            <span className="mx-1">·</span>
            <span dir="auto">{quickReply.createdBy.name}</span>
          </p>
          <div className="mt-2.5 flex justify-end">
            <RowActions quickReply={quickReply} />
          </div>
        </div>
      )}
    />
  );
}

function RowActions({ quickReply }: { quickReply: QuickReply }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remove = useDeleteQuickReply();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const cancel = () => {
    setConfirming(false);
    setError(null);
    deleteRef.current?.focus();
  };

  const onConfirm = async () => {
    setError(null);
    try {
      await remove.mutateAsync(quickReply.id);
      setConfirming(false);
    } catch {
      setError(t("quickReplies.deleteError"));
      confirmRef.current?.focus();
    }
  };

  useEffect(() => {
    if (confirming) {
      confirmRef.current?.focus();
    }
  }, [confirming]);

  const menuItems: ActionMenuItem[] = [
    {
      key: "edit",
      label: t("quickReplies.editAction"),
      icon: <PencilIcon />,
      onClick: () => navigate(`/quick-replies/${quickReply.id}/edit`),
    },
    {
      key: "delete",
      label: t("quickReplies.deleteAction"),
      icon: <TrashIcon />,
      destructive: true,
      onClick: () => {
        setError(null);
        setConfirming(true);
      },
    },
  ];

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex items-center justify-end"
      onKeyDown={(event) => {
        if (event.key === "Escape" && confirming) {
          event.stopPropagation();
          cancel();
        }
      }}
      onBlur={(event) => {
        if (!confirming || remove.isPending) return;
        if (
          !(event.relatedTarget instanceof Node) ||
          !wrapperRef.current?.contains(event.relatedTarget)
        ) {
          setConfirming(false);
          setError(null);
        }
      }}
    >
      <ActionMenu
        items={menuItems}
        triggerLabel={t("quickReplies.columns.actions")}
        externalTriggerRef={deleteRef}
      />

      {confirming && (
        <div
          role="dialog"
          aria-label={t("quickReplies.deleteConfirmLabel", { title: quickReply.title })}
          className="absolute end-0 top-full z-20 mt-1 w-56 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-popover text-popover-foreground p-3 text-start shadow-flyout"
        >
          <p className="text-xs leading-5 text-foreground" dir="auto">
            {t("quickReplies.deleteConfirmLabel", { title: quickReply.title })}
          </p>
          {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
          <div className="mt-2.5 flex justify-end gap-2">
            <button
              type="button"
              className="button-ghost min-h-8 px-2.5 py-1 text-xs"
              disabled={remove.isPending}
              onClick={cancel}
            >
              {t("common.cancel")}
            </button>
            <button
              ref={confirmRef}
              type="button"
              className="button-danger min-h-8 w-auto gap-1.5 px-2.5 py-1 text-xs"
              disabled={remove.isPending}
              onClick={onConfirm}
            >
              {remove.isPending ? (
                <>
                  <SpinnerIcon className="size-3.5" />
                  {t("quickReplies.deleting")}
                </>
              ) : error ? (
                t("common.retry")
              ) : (
                t("quickReplies.confirmDelete")
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
