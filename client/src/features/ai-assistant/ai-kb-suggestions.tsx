import type { UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getAiErrorMessage, isAiNotConfigured } from "./ai-assistant-error";
import { scoreLevel } from "./score-level";
import type { AiKbSuggestionsResponse } from "./ai-assistant.types";

/**
 * KB Suggestions sub-section. The backend retrieves and validates the PUBLISHED
 * candidate articles; this only ranks the display. "Open Article" is normal
 * router navigation to the existing internal KB detail route — no duplicate
 * viewer. Independent state from the other AI actions.
 *
 * Insert-into-Reply is intentionally NOT offered here: the internal
 * `/knowledge-base/:id` route is role-guarded (not customer-accessible) and
 * there is no server-configured public article URL, so nothing safe can be put
 * into a customer reply for the MVP (see ADR-034 Phase 5).
 */
export function AiKbSuggestions({
  mutation,
}: {
  mutation: UseMutationResult<AiKbSuggestionsResponse, unknown, void>;
}) {
  const { t } = useTranslation();

  if (isAiNotConfigured(mutation.error)) return null; // panel renders the unavailable state

  // Idle and pending are represented by the launcher card in the action grid.
  if (mutation.isPending) return null;

  if (mutation.isError) {
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

  const articles = mutation.data?.result.articles;
  if (!articles) return null; // idle: the launcher card in the action grid is the trigger

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("aiAssistant.suggestedSolutionsHeading")}
      </p>

      {articles.length === 0 ? (
        // A valid "nothing relevant" result — not an error.
        <p className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-muted-foreground">
          {t("aiAssistant.noKbResults")}
        </p>
      ) : (
        <ol className="space-y-3">
          {articles.map((article) => (
            <li key={article.id} className="space-y-1">
              <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{article.title}</p>
              {article.reason && (
                <p className="text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{article.reason}</p>
              )}
              <p className="flex flex-wrap items-center gap-x-2 text-xs">
                <span className="text-muted-foreground">
                  {t(`aiAssistant.relevance.${scoreLevel(article.relevance)}`)}
                </span>
                <Link
                  to={`/knowledge-base/${article.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {t("aiAssistant.openArticle")}
                </Link>
              </p>
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="button-secondary sm:w-auto" onClick={() => mutation.mutate()}>
        {t("aiAssistant.regenerate")}
      </button>
    </div>
  );
}
