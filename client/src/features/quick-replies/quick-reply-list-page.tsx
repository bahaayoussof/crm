import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  DataTableSurface,
  DataTableToolbar,
  DataTableSearch,
  DataTableSkeleton,
} from "@/components/shared/data-table";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useQuickReplies } from "./quick-reply-hooks";
import { QuickReplyTable } from "./quick-reply-table";
import { QuickReplyCreateModal } from "./quick-reply-create-modal";
import { PageHeader, QuickRepliesPage, StatePanel } from "./quick-replies-ui";

export function QuickReplyListPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const search = params.get("search") ?? "";
  const debouncedSearch = useDebouncedValue(search);
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const quickReplies = useQuickReplies({ search: debouncedSearch, page, limit: 15 });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  };

  const hasFilters = Boolean(debouncedSearch);

  return (
    <QuickRepliesPage>
      <div className="space-y-5">
        <PageHeader
          title={t("quickReplies.title")}
          description={t("quickReplies.description")}
          actions={<button type="button" className="button-link" onClick={() => setCreateOpen(true)}>{t("quickReplies.create")}</button>}
        />

        {/* Unified DataTable Surface */}
        <DataTableSurface>
          {/* Shared Single-Row Compact Toolbar */}
          <DataTableToolbar>
            {/* Search Input */}
            <DataTableSearch
              id="quick-reply-search"
              ariaLabel={t("quickReplies.search")}
              value={search}
              onChange={(value) => setFilter("search", value)}
              placeholder={t("quickReplies.search")}
            />

            {/* Right-Side Actions */}
            {hasFilters && (
              <div className="flex items-center gap-2 sm:ms-auto">
                <button
                  className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setParams({})}
                >
                  {t("quickReplies.clearFilters")}
                </button>
              </div>
            )}
          </DataTableToolbar>

          {/* Table Body & Loading / Error / Empty States */}
          {quickReplies.isLoading ? (
            <div className="p-4" aria-label={t("common.loading")}>
              <DataTableSkeleton columns={4} />
            </div>
          ) : quickReplies.isError ? (
            <div className="p-6">
              <StatePanel action={<button className="button-secondary" onClick={() => quickReplies.refetch()}>{t("common.retry")}</button>}>
                {t("quickReplies.loadError")}
              </StatePanel>
            </div>
          ) : quickReplies.data && quickReplies.data.data.length === 0 ? (
            <div className="p-6">
              <StatePanel action={hasFilters ? <button className="button-secondary" onClick={() => setParams({})}>{t("quickReplies.clearFilters")}</button> : <button type="button" className="button-link" onClick={() => setCreateOpen(true)}>{t("quickReplies.create")}</button>}>
                {hasFilters ? t("quickReplies.noMatches") : t("quickReplies.empty")}
              </StatePanel>
            </div>
          ) : (
            <QuickReplyTable
              quickReplies={quickReplies.data?.data ?? []}
              page={page}
              pageSize={quickReplies.data?.meta.limit ?? 15}
              pageCount={quickReplies.data?.meta.totalPages ?? 0}
              totalCount={quickReplies.data?.meta.total}
              onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
            />
          )}
        </DataTableSurface>

        <QuickReplyCreateModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={() => quickReplies.refetch()}
        />
      </div>
    </QuickRepliesPage>
  );
}
