import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, FileText, MessageSquareText, Tags } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { AiActionCard } from "./ai-action-card";
import {
  useTicketAiClassification,
  useTicketAiKbSuggestions,
  useTicketAiSuggestedReply,
  useTicketAiSummary,
} from "./ai-assistant-hooks";
import { getAiErrorMessage, isAiNotConfigured } from "./ai-assistant-error";
import { AiSummary } from "./ai-summary";
import { AiSuggestedReply } from "./ai-suggested-reply";
import { AiCategorySuggestion } from "./ai-category-suggestion";
import { AiKbSuggestions } from "./ai-kb-suggestions";
import type { AiLocale, CategoryApplyApi, ReplyInsertionApi } from "./ai-assistant.types";

/**
 * Internal-only AI Assistant for Ticket Details.
 *
 * The Ticket sidebar only ever shows a compact launcher; the interactive
 * workspace (Summarize / Suggest Reply / Suggest Category / Find Solution) lives
 * in a responsive {@link Sheet} — a right-side drawer at `lg`+, a bottom sheet
 * below `lg`. The sheet is a portalled overlay taken out of page flow, so long
 * AI results never grow the Ticket page or move its scroll position.
 *
 * State ownership: this component stays mounted for the life of the Ticket page
 * and owns all four AI mutations. The sheet body unmounts when closed, but the
 * mutation results live here, so reopening the drawer shows the previously
 * generated Summary, Reply, Category and KB results unchanged. Open/close is
 * controlled by the page (the header "AI Assistant" button); this component
 * renders no visible launcher of its own.
 *
 * Every action is on-demand: opening the drawer fires no request. Nothing here
 * mutates the ticket, sends a message, or creates a notification.
 */
export function AiAssistantPanel({
  ticketId,
  replyInsertion,
  currentCategoryId,
  categoryApply,
  open,
  onClose,
  returnFocusRef,
}: {
  ticketId: string;
  replyInsertion?: ReplyInsertionApi;
  currentCategoryId?: string | null;
  /** Present only when the current user may change the ticket category. */
  categoryApply?: CategoryApplyApi;
  /** Drawer visibility — owned by the page. */
  open: boolean;
  onClose: () => void;
  /** Focus returns here after the drawer closes (the header trigger). */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t, i18n } = useTranslation();
  const locale: AiLocale = i18n.language === "ar" ? "ar" : "en";

  const summary = useTicketAiSummary(ticketId, locale);
  const suggestedReply = useTicketAiSuggestedReply(ticketId);
  const classification = useTicketAiClassification(ticketId);
  const kbSuggestions = useTicketAiKbSuggestions(ticketId);

  // The actions share one provider config, so any of them hitting
  // AI_NOT_CONFIGURED means the feature is unavailable for this workspace.
  const unavailable =
    isAiNotConfigured(summary.error) ||
    isAiNotConfigured(suggestedReply.error) ||
    isAiNotConfigured(classification.error) ||
    isAiNotConfigured(kbSuggestions.error);

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={t("aiAssistant.title")}
        closeLabel={t("aiAssistant.closeAssistant")}
        returnFocusRef={returnFocusRef}
      >
        {unavailable ? (
          <div className="rounded-md border border-border bg-surface-subtle p-3">
            <p className="text-sm font-medium text-foreground">{t("aiAssistant.unavailable")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("aiAssistant.unavailableHint")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Launcher grid — the four capabilities as spaced action cards.
                Two columns once the viewport is wide enough, one column on
                narrow mobile. Results render in the sections below, never here. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AiActionCard
                icon={FileText}
                title={t("aiAssistant.summarize")}
                description={t("aiAssistant.actions.summary.description")}
                pending={summary.isPending}
                pendingLabel={t("aiAssistant.summarizing")}
                onClick={() => summary.mutate()}
              />
              <AiActionCard
                icon={MessageSquareText}
                title={t("aiAssistant.suggestReply")}
                description={t("aiAssistant.actions.reply.description")}
                pending={suggestedReply.isPending}
                pendingLabel={t("aiAssistant.generatingReply")}
                onClick={() => suggestedReply.mutate()}
              />
              <AiActionCard
                icon={Tags}
                title={t("aiAssistant.suggestCategory")}
                description={t("aiAssistant.actions.category.description")}
                pending={classification.isPending}
                pendingLabel={t("aiAssistant.analyzingCategory")}
                onClick={() => classification.mutate()}
              />
              <AiActionCard
                icon={BookOpen}
                title={t("aiAssistant.findSolution")}
                description={t("aiAssistant.actions.solution.description")}
                pending={kbSuggestions.isPending}
                pendingLabel={t("aiAssistant.findingSolutions")}
                onClick={() => kbSuggestions.mutate()}
              />
            </div>

            <SummarySection summary={summary} />
            <AiSuggestedReply mutation={suggestedReply} replyInsertion={replyInsertion} />
            <AiCategorySuggestion
              mutation={classification}
              currentCategoryId={currentCategoryId}
              categoryApply={categoryApply}
            />
            <AiKbSuggestions mutation={kbSuggestions} />
          </div>
        )}
      </Sheet>
    </>
  );
}

type SummaryMutation = ReturnType<typeof useTicketAiSummary>;

function SummarySection({ summary }: { summary: SummaryMutation }) {
  const { t } = useTranslation();

  // Idle and pending are represented by the launcher card in the action grid;
  // this section only renders the generated summary or an error.
  if (!summary.data && !summary.isError) return null;

  if (summary.isError) {
    return (
      <div className="space-y-2">
        <p
          className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground [overflow-wrap:anywhere]"
          role="alert"
        >
          {getAiErrorMessage(summary.error, t)}
        </p>
        <button type="button" className="button-secondary sm:w-auto" onClick={() => summary.mutate()}>
          {t("aiAssistant.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("aiAssistant.summaryHeading")}
      </p>
      {summary.data && <AiSummary summary={summary.data.result} />}
      <button type="button" className="button-secondary sm:w-auto" onClick={() => summary.mutate()}>
        {t("aiAssistant.regenerate")}
      </button>
    </div>
  );
}
