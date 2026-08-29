import { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getAiErrorMessage } from "./ai-assistant-error";
import type { AiSuggestedReplyResponse, ReplyInsertionApi } from "./ai-assistant.types";

type Phase = "idle" | "confirm";

/**
 * Suggested Reply sub-section of the AI Assistant panel. Independent state from
 * the summary. Generating / regenerating never touches the composer; only the
 * explicit "Insert into Reply" action does, and only via {@link ReplyInsertionApi}.
 */
export function AiSuggestedReply({
  mutation,
  replyInsertion,
}: {
  mutation: UseMutationResult<AiSuggestedReplyResponse, unknown, void>;
  replyInsertion?: ReplyInsertionApi;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<{ kind: "status" | "alert"; text: string } | null>(null);

  const draft = mutation.data?.result.reply;

  const doInsert = (mode: "cursor" | "replace") => {
    setPhase("idle");
    if (!draft || !replyInsertion) return;
    const outcome = replyInsertion.insertSuggestedReply(draft, mode);
    if (outcome === "too-long") {
      setNotice({ kind: "alert", text: t("aiAssistant.errors.replyTooLong") });
    } else if (outcome === "inserted") {
      setNotice({ kind: "status", text: t("aiAssistant.inserted") });
    } else {
      setNotice(null);
    }
  };

  const onInsertClick = () => {
    setNotice(null);
    if (replyInsertion?.hasReplyText()) setPhase("confirm");
    else doInsert("cursor");
  };

  const regenerate = () => {
    setNotice(null);
    setPhase("idle");
    mutation.mutate();
  };

  if (mutation.isPending) {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <p className="text-sm text-muted-foreground">{t("aiAssistant.generatingReply")}</p>
        <div className="space-y-2" aria-hidden="true">
          <div className="h-3 w-full animate-pulse rounded bg-surface-subtle" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-surface-subtle" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-subtle" />
        </div>
      </div>
    );
  }

  if (mutation.isError) {
    return (
      <div className="space-y-2">
        <p
          className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground [overflow-wrap:anywhere]"
          role="alert"
        >
          {getAiErrorMessage(mutation.error, t)}
        </p>
        <button type="button" className="button-secondary sm:w-auto" onClick={regenerate}>
          {t("aiAssistant.retry")}
        </button>
      </div>
    );
  }

  if (draft !== undefined) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("aiAssistant.suggestedReplyHeading")}
        </p>
        <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface-subtle p-3 text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
          {draft}
        </p>

        {phase === "confirm" ? (
          <div
            role="group"
            aria-label={t("aiAssistant.insertConfirm.title")}
            className="space-y-2 rounded-md border border-border bg-surface-subtle p-3"
          >
            <p className="text-sm font-medium text-foreground">{t("aiAssistant.insertConfirm.title")}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="button-secondary sm:w-auto" onClick={() => doInsert("cursor")}>
                {t("aiAssistant.insertConfirm.atCursor")}
              </button>
              <button type="button" className="button-secondary sm:w-auto" onClick={() => doInsert("replace")}>
                {t("aiAssistant.insertConfirm.replace")}
              </button>
              <button type="button" className="button-secondary sm:w-auto" onClick={() => setPhase("idle")}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {replyInsertion && (
              <button type="button" className="button-secondary sm:w-auto" onClick={onInsertClick}>
                {t("aiAssistant.insertIntoReply")}
              </button>
            )}
            <button type="button" className="button-secondary sm:w-auto" onClick={regenerate}>
              {t("aiAssistant.regenerate")}
            </button>
          </div>
        )}

        {notice && (
          <p
            className={
              notice.kind === "alert"
                ? "text-xs text-danger-foreground"
                : "text-xs text-muted-foreground"
            }
            role={notice.kind === "alert" ? "alert" : "status"}
          >
            {notice.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <button type="button" className="button-secondary sm:w-auto" onClick={() => mutation.mutate()}>
      {t("aiAssistant.suggestReply")}
    </button>
  );
}
