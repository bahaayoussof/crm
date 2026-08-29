import { useTranslation } from "react-i18next";
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
 * Internal-only AI Assistant section for the Ticket Details sidebar.
 *
 * Phase 2: Summarize Ticket. Phase 3: Suggest Reply (+ "Insert into Reply" via
 * `replyInsertion`, which bridges to the existing public reply composer). Every
 * action is on-demand, keeps its result in mutation state only, and never
 * mutates the ticket, sends a message, or creates a notification.
 *
 * Rendered inside `TicketSidebar`'s `divide-y` container, so it uses the same
 * `<section>` / `<h2>` shell as the sibling sidebar sections.
 */
export function AiAssistantPanel({
  ticketId,
  replyInsertion,
  currentCategoryId,
  categoryApply,
}: {
  ticketId: string;
  replyInsertion?: ReplyInsertionApi;
  currentCategoryId?: string | null;
  /** Present only when the current user may change the ticket category. */
  categoryApply?: CategoryApplyApi;
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
    <section className="space-y-3 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">{t("aiAssistant.title")}</h2>

      {unavailable ? (
        <div className="rounded-md border border-border bg-surface-subtle p-3">
          <p className="text-sm font-medium text-foreground">{t("aiAssistant.unavailable")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("aiAssistant.unavailableHint")}</p>
        </div>
      ) : (
        <div className="space-y-4">
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
    </section>
  );
}

type SummaryMutation = ReturnType<typeof useTicketAiSummary>;

function SummarySection({ summary }: { summary: SummaryMutation }) {
  const { t } = useTranslation();
  const showSummarize = !summary.data && !summary.isPending && !summary.isError;

  if (showSummarize) {
    return (
      <button type="button" className="button-secondary sm:w-auto" onClick={() => summary.mutate()}>
        {t("aiAssistant.summarize")}
      </button>
    );
  }

  if (summary.isPending) {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <p className="text-sm text-muted-foreground">{t("aiAssistant.summarizing")}</p>
        <div className="space-y-2" aria-hidden="true">
          <div className="h-3 w-2/3 animate-pulse rounded bg-surface-subtle" />
          <div className="h-3 w-full animate-pulse rounded bg-surface-subtle" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-surface-subtle" />
        </div>
      </div>
    );
  }

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
