import { useEffect, useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getTicketError } from "@/features/tickets/ticket-error";
import { getAiErrorMessage, isAiNoCandidates, isAiNotConfigured } from "./ai-assistant-error";
import { scoreLevel } from "./score-level";
import type { AiCategorySuggestionResponse, CategoryApplyApi } from "./ai-assistant.types";

/**
 * Suggested Category sub-section. The AI picks one existing active category
 * (server-validated); applying it goes through the normal ticket-update mutation
 * via {@link CategoryApplyApi}. Generating or regenerating never mutates the
 * ticket. Independent state from Summary / Suggested Reply.
 */
export function AiCategorySuggestion({
  mutation,
  currentCategoryId,
  categoryApply,
}: {
  mutation: UseMutationResult<AiCategorySuggestionResponse, unknown, void>;
  currentCategoryId?: string | null;
  /** Present only when the current user may change the ticket category. */
  categoryApply?: CategoryApplyApi;
}) {
  const { t } = useTranslation();
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const suggestedId = mutation.data?.result.categoryId;
  // A fresh suggestion clears any prior apply state.
  useEffect(() => {
    setApplied(false);
    setApplying(false);
    setApplyError(null);
  }, [suggestedId]);

  if (isAiNotConfigured(mutation.error)) return null; // panel renders the unavailable state

  if (mutation.isPending) {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <p className="text-sm text-muted-foreground">{t("aiAssistant.analyzingCategory")}</p>
        <div className="space-y-2" aria-hidden="true">
          <div className="h-3 w-1/2 animate-pulse rounded bg-surface-subtle" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-subtle" />
        </div>
      </div>
    );
  }

  if (mutation.isError) {
    if (isAiNoCandidates(mutation.error)) {
      // Retrying cannot help — no Retry action.
      return (
        <p className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-muted-foreground">
          {t("aiAssistant.noCategoryCandidates")}
        </p>
      );
    }
    return (
      <div className="space-y-2">
        <p
          className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground [overflow-wrap:anywhere]"
          role="alert"
        >
          {getAiErrorMessage(mutation.error, t)}
        </p>
        <button type="button" className="button-secondary sm:w-auto" onClick={() => mutation.mutate()}>
          {t("aiAssistant.retry")}
        </button>
      </div>
    );
  }

  const data = mutation.data?.result;
  if (!data) {
    return (
      <button type="button" className="button-secondary sm:w-auto" onClick={() => mutation.mutate()}>
        {t("aiAssistant.suggestCategory")}
      </button>
    );
  }

  const level = scoreLevel(data.confidence);
  const isCurrent = Boolean(currentCategoryId) && data.categoryId === currentCategoryId;

  const doApply = async () => {
    if (!categoryApply || applying) return;
    setApplyError(null);
    setApplying(true);
    try {
      await categoryApply.apply(data.categoryId);
      setApplied(true);
    } catch (caught) {
      setApplyError(getTicketError(caught, t("aiAssistant.errors.applyCategoryFailed"), t));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("aiAssistant.suggestedCategoryHeading")}
      </p>
      <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{data.categoryName}</p>
      <p className="text-xs text-muted-foreground">
        {t("aiAssistant.confidenceLabel")}:{" "}
        <span className="font-medium text-foreground">{t(`aiAssistant.confidence.${level}`)}</span>
      </p>
      {data.reason && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("aiAssistant.reasonLabel")}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
            {data.reason}
          </p>
        </div>
      )}

      {applyError && (
        <p className="text-xs text-danger-foreground [overflow-wrap:anywhere]" role="alert">
          {applyError}
        </p>
      )}
      {applied ? (
        <p className="text-xs text-success-foreground" role="status">
          {t("aiAssistant.categoryApplied")}
        </p>
      ) : isCurrent ? (
        <p className="text-xs text-muted-foreground">{t("aiAssistant.categoryAlreadyCurrent")}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {categoryApply && !isCurrent && !applied && (
          <button
            type="button"
            className="button-secondary sm:w-auto"
            disabled={applying}
            onClick={doApply}
          >
            {applying ? t("common.saving") : t("aiAssistant.applyCategory")}
          </button>
        )}
        <button
          type="button"
          className="button-secondary sm:w-auto"
          onClick={() => {
            setApplyError(null);
            mutation.mutate();
          }}
        >
          {t("aiAssistant.regenerate")}
        </button>
      </div>
    </div>
  );
}
