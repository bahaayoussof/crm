import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Paperclip } from "lucide-react";
import { AttachmentCompactGrid } from "@/features/attachments/attachment-ui";
import { ACCEPTED_INPUT_ACCEPT, validateAttachmentFile } from "@/features/attachments/attachment.types";
import { QuickReplyPicker } from "@/features/quick-replies/quick-reply-picker";
import { getTicketError } from "./ticket-error";
import { formatTicketDate } from "./ticket-format";
import { useCreateTicketMessage, useCreateTicketNote } from "./ticket-hooks";
import { MentionNode } from "./ticket-mention-node";
import { TicketMentionPlugin } from "./ticket-mention-plugin";
import { TicketReplyEditor, type TicketReplyEditorHandle } from "./ticket-reply-editor";
import type { TicketChannel, TicketDetail, TicketMessageResult } from "./ticket.types";

type Mode = "reply" | "note";
type Tab = "reply" | "attachments" | "activity" | "description";
type AttachmentItem = { id: string; fileName: string; mimeType: string; createdAt: string };

/** Cross-column bridge for the AI "Insert into Reply" action. Exposes only the
 * public-reply operations — never internal composer state. */
export type TicketWorkspaceHandle = {
  hasReplyText: () => boolean;
  insertSuggestedReply: (text: string, mode: "cursor" | "replace") => "inserted" | "too-long";
};

type TicketWorkspaceTabsProps = {
  ticketId: string;
  canMutate: boolean;
  channel?: TicketChannel;
  customerPhone?: string | null;
  attachments: AttachmentItem[];
  attachmentsLoading: boolean;
  attachmentsError: boolean;
  onRetryAttachments: () => void;
  history: TicketDetail["history"];
  description: string;
  locale: string;
  /** Fired after a successful reply or note so the page can scroll the conversation to latest. */
  onSent?: () => void;
  /** A file was picked via the native OS dialog — the page enters attach mode and
   * swaps the conversation message viewport for the upload workspace (not this panel). */
  onAttachFile?: (file: File) => void;
  /** True while the conversation viewport shows the upload workspace. */
  attachMode?: boolean;
  className?: string;
};

/**
 * The lower workspace card beneath the conversation: four tabs — Reply,
 * Attachments, Activity, Description — sharing one bounded, compact surface.
 *
 * The Reply panel (and its Lexical editor) is only ever shown/hidden with a
 * `hidden` class — never unmounted — so the draft, undo history, Quick Reply
 * insertion and the AI "Insert into Reply" handle survive tab switches and
 * attachment mode.
 */
export const TicketWorkspaceTabs = forwardRef<TicketWorkspaceHandle, TicketWorkspaceTabsProps>(
  function TicketWorkspaceTabs(
    {
      ticketId,
      canMutate,
      channel,
      customerPhone,
      attachments,
      attachmentsLoading,
      attachmentsError,
      onRetryAttachments,
      history,
      description,
      locale,
      onSent,
      onAttachFile,
      attachMode = false,
      className = "",
    },
    ref,
  ) {
    const { t } = useTranslation();
    const isWhatsapp = channel === "WHATSAPP";
    const [tab, setTab] = useState<Tab>("reply");
    const [mode, setMode] = useState<Mode>("reply");
    const [replyText, setReplyText] = useState("");
    const [noteText, setNoteText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [insertError, setInsertError] = useState<string | null>(null);
    const [attachError, setAttachError] = useState<string | null>(null);
    const editorRef = useRef<TicketReplyEditorHandle>(null);
    const noteEditorRef = useRef<TicketReplyEditorHandle>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messageMutation = useCreateTicketMessage(ticketId);
    const noteMutation = useCreateTicketNote(ticketId);
    const mutation = mode === "reply" ? messageMutation : noteMutation;
    const pending = messageMutation.isPending || noteMutation.isPending;
    const canSubmit = mode === "reply" ? replyText.trim().length > 0 : noteText.trim().length > 0;

    // The composer "Attach file" control opens the native OS dialog directly; only
    // after a valid file is chosen does the page enter attach mode.
    const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
      const chosen = event.target.files?.[0];
      event.target.value = "";
      if (!chosen) return;
      const { file, error: fileError } = validateAttachmentFile(chosen, t);
      if (fileError || !file) {
        setAttachError(fileError ?? t("attachments.errors.UNSUPPORTED_FILE_TYPE"));
        return;
      }
      setAttachError(null);
      onAttachFile?.(file);
    };

    const insertQuickReply = (snippet: string) => {
      const outcome = editorRef.current?.insertText(snippet) ?? "too-long";
      if (outcome === "too-long") {
        setInsertError(t("quickReplies.picker.lengthExceeded"));
        return;
      }
      setInsertError(null);
    };

    useImperativeHandle(
      ref,
      () => ({
        hasReplyText: () => editorRef.current?.hasText() ?? replyText.trim().length > 0,
        insertSuggestedReply: (text, insertMode) => {
          setTab("reply");
          setMode("reply");
          const outcome =
            insertMode === "replace"
              ? editorRef.current?.replaceText(text) ?? "too-long"
              : editorRef.current?.insertText(text) ?? "too-long";
          if (outcome === "too-long") return "too-long";
          setError(null);
          setSuccess(null);
          setInsertError(null);
          return "inserted";
        },
      }),
      [replyText],
    );

    const submit = async () => {
      if (!canMutate || pending || !canSubmit) return;
      const body =
        mode === "reply" ? editorRef.current?.getHtml() ?? "" : noteEditorRef.current?.getHtml() ?? "";
      setError(null);
      setSuccess(null);
      try {
        const result = (await mutation.mutateAsync({ body })) as TicketMessageResult;
        if (mode === "reply") {
          editorRef.current?.clear();
          setReplyText("");
        } else {
          noteEditorRef.current?.clear();
          setNoteText("");
        }
        onSent?.();
        if (mode === "reply" && result?.delivery?.status === "FAILED") {
          setError(
            t(`tickets.conversation.whatsappDelivery.${result.delivery.reason ?? "PROVIDER_REJECTED"}`, {
              defaultValue: t("tickets.conversation.whatsappDelivery.PROVIDER_REJECTED"),
            }),
          );
        } else {
          setSuccess(t(mode === "reply" ? "tickets.conversation.replySuccess" : "tickets.conversation.noteSuccess"));
        }
      } catch (caught) {
        setError(
          getTicketError(
            caught,
            t(mode === "reply" ? "tickets.conversation.replyError" : "tickets.conversation.noteError"),
            t,
          ),
        );
      }
    };

    const tabs: { value: Tab; label: string; count?: number }[] = [
      { value: "reply", label: t("tickets.conversation.replyTab") },
      { value: "attachments", label: t("attachments.title"), count: attachments.length },
      { value: "activity", label: t("tickets.activity"), count: history.length },
      { value: "description", label: t("tickets.descriptionLabel") },
    ];

    return (
      <section
        className={`overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-subtle ${className}`}
        aria-label={t("tickets.workspaceTabs")}
      >
        <div
          className="flex w-full flex-wrap border-b border-border px-3 sm:px-5"
          role="tablist"
          aria-label={t("tickets.workspaceTabs")}
        >
          {tabs.map(({ value, label, count }) => (
            <button
              type="button"
              role="tab"
              key={value}
              aria-selected={tab === value}
              className={`-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                tab === value
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab(value)}
            >
              <span>{label}</span>
              {typeof count === "number" && count > 0 && (
                <span className="rounded-full bg-surface-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 sm:px-5">
          {/* Reply — never unmounted (draft + editor state must survive tab / attach-mode changes). */}
          <div role="tabpanel" hidden={tab !== "reply"} className={tab === "reply" ? "space-y-3" : ""}>
            <div className={mode === "reply" ? "space-y-3" : "hidden"}>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t("tickets.conversation.replyLabel")}</p>
                  <p className="mt-1 text-xs text-muted-foreground" id="conversation-reply-help">
                    {t("tickets.conversation.replyHelp")}
                  </p>
                </div>
                {mode === "reply" && canMutate && (
                  <div className="shrink-0">
                    <QuickReplyPicker disabled={pending} onSelect={insertQuickReply} />
                  </div>
                )}
              </div>
              {isWhatsapp && (
                <p className="text-xs text-muted-foreground">
                  {t("tickets.conversation.whatsappReplyHint")}
                  {customerPhone ? (
                    <>
                      {" "}
                      <span dir="ltr">{customerPhone}</span>
                    </>
                  ) : (
                    <> — {t("tickets.conversation.whatsappNoPhone")}</>
                  )}
                </p>
              )}
              <TicketReplyEditor
                ref={editorRef}
                id="conversation-reply"
                ariaLabel={t("tickets.conversation.replyLabel")}
                ariaDescribedBy="conversation-reply-help"
                placeholder={t("tickets.conversation.replyPlaceholder")}
                disabled={!canMutate || pending}
                onTextChange={(value) => {
                  setReplyText(value);
                  setInsertError(null);
                }}
              />
            </div>

            {/* Internal note — same Lexical editor + toolbar as Reply, plus the
                @mention typeahead. Always mounted (independent draft survives the
                mode switch); shown/hidden with `hidden`. */}
            <div className={mode === "note" ? "space-y-3" : "hidden"}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("tickets.conversation.noteLabel")}</p>
                <p className="mt-1 text-xs text-muted-foreground" id="conversation-note-help">
                  {t("tickets.conversation.noteHelp")}
                </p>
              </div>
              <TicketReplyEditor
                ref={noteEditorRef}
                extraNodes={[MentionNode]}
                // Mount the typeahead only while the note tab is active — the
                // plugin permanently appends a `role="listbox"` anchor to the
                // body, which otherwise collides with the reply-tab Quick Reply.
                extraPlugins={mode === "note" ? <TicketMentionPlugin /> : undefined}
                id="conversation-note"
                ariaLabel={t("tickets.conversation.noteLabel")}
                ariaDescribedBy="conversation-note-help"
                placeholder={t("tickets.conversation.notePlaceholder")}
                disabled={!canMutate || pending}
                onTextChange={setNoteText}
              />
            </div>

            {/* Reply | Internal note mode selector — NOT a top-level workspace tab (spec §31). */}
            <div className="flex gap-1 text-xs" role="tablist" aria-label={t("tickets.conversation.composerMode")}>
              {(["reply", "note"] as Mode[]).map((value) => (
                <button
                  type="button"
                  role="tab"
                  key={value}
                  aria-selected={mode === value}
                  className={`rounded-md px-2 py-1 font-medium transition-colors ${
                    mode === value
                      ? "bg-surface-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setMode(value);
                    setError(null);
                    setSuccess(null);
                    setInsertError(null);
                  }}
                >
                  {t(`tickets.conversation.${value}Tab`)}
                </button>
              ))}
            </div>

            {!canMutate && (
              <p className="text-sm text-warning-foreground" role="status">
                {t("tickets.conversation.readOnly")}
              </p>
            )}
            {insertError && (
              <p className="text-sm text-danger-foreground" role="alert">
                {insertError}
              </p>
            )}
            {error && (
              <p className="text-sm text-danger-foreground" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-success-foreground" role="status">
                {success}
              </p>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
              <div className="sm:me-auto">
                {canMutate && !attachMode && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      accept={ACCEPTED_INPUT_ACCEPT}
                      aria-hidden="true"
                      tabIndex={-1}
                      onChange={pickFile}
                    />
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      {t("attachments.attachFile")}
                    </button>
                    {attachError && (
                      <p className="mt-1 text-xs text-danger-foreground" role="alert">
                        {attachError}
                      </p>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                className="button-primary sm:ms-auto sm:w-auto"
                disabled={!canMutate || !canSubmit || pending}
                onClick={submit}
              >
                {pending
                  ? t(mode === "reply" ? "tickets.conversation.sending" : "tickets.conversation.adding")
                  : t(mode === "reply" ? "tickets.conversation.sendReply" : "tickets.conversation.addNote")}
              </button>
            </div>
          </div>

          {/* Attachments */}
          <div role="tabpanel" hidden={tab !== "attachments"}>
            <AttachmentsPanel
              attachments={attachments}
              isLoading={attachmentsLoading}
              isError={attachmentsError}
              onRetry={onRetryAttachments}
              locale={locale}
            />
          </div>

          {/* Activity */}
          <div role="tabpanel" hidden={tab !== "activity"}>
            <ActivityBody history={history} language={locale} />
          </div>

          {/* Description */}
          <div role="tabpanel" hidden={tab !== "description"}>
            <DescriptionBody description={description} />
          </div>
        </div>
      </section>
    );
  },
);

const ATTACHMENTS_PREVIEW_COUNT = 3;

function AttachmentsPanel({
  attachments,
  isLoading,
  isError,
  onRetry,
  locale,
}: {
  attachments: AttachmentItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const hasMore = attachments.length > ATTACHMENTS_PREVIEW_COUNT;
  const visible = showAll ? attachments : attachments.slice(0, ATTACHMENTS_PREVIEW_COUNT);

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("common.loading")}
      </p>
    );
  if (isError)
    return (
      <div
        className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground"
        role="alert"
      >
        {t("attachments.loadError")}{" "}
        <button type="button" className="button-secondary mt-2" onClick={onRetry}>
          {t("common.retry")}
        </button>
      </div>
    );
  if (attachments.length === 0) return <p className="text-sm text-muted-foreground">{t("attachments.none")}</p>;

  return (
    <div className={`space-y-3 ${showAll ? "lg:max-h-[20rem] lg:overflow-y-auto" : ""}`}>
      <AttachmentCompactGrid attachments={visible} scope="internal" locale={locale} />
      {hasMore && (
        <button
          type="button"
          className="rounded-sm text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? t("attachments.showLess") : t("attachments.viewAll")}
        </button>
      )}
    </div>
  );
}

const ACTIVITY_PREVIEW_COUNT = 5;

function ActivityBody({ history, language }: { history: TicketDetail["history"]; language: string }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const hasMore = history.length > ACTIVITY_PREVIEW_COUNT;
  const visible = showAll ? history : history.slice(0, ACTIVITY_PREVIEW_COUNT);

  if (history.length === 0) return <p className="text-sm text-muted-foreground">{t("tickets.noHistory")}</p>;

  return (
    <>
      <ol className={`space-y-3 ${showAll && hasMore ? "max-h-[20rem] overflow-y-auto pe-1" : ""}`}>
        {visible.map((event) => (
          <li className="relative ps-4" key={event.id}>
            <span className="absolute start-0 top-1.5 size-1.5 rounded-full bg-border-strong" aria-hidden="true" />
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-3">
              <p className="min-w-0 break-words text-sm font-medium text-foreground">
                {t(`tickets.historyActions.${event.action}`, { defaultValue: event.action })}
              </p>
              <time
                className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                dir="ltr"
                dateTime={event.createdAt}
              >
                {formatTicketDate(event.createdAt, language)}
              </time>
            </div>
            <p className="mt-0.5 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {event.actor?.name ?? t("tickets.systemActor")}
              {event.oldValue || event.newValue
                ? `: ${event.oldValue ? displayValue(event.oldValue, t) : t("common.notProvided")} → ${
                    event.newValue ? displayValue(event.newValue, t) : t("common.notProvided")
                  }`
                : ""}
            </p>
          </li>
        ))}
      </ol>
      {hasMore && (
        <button
          type="button"
          className="mt-3 rounded-sm text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? t("tickets.conversation.showLess") : t("tickets.viewAllActivity")}
        </button>
      )}
    </>
  );
}

const DESC_LONG_CHARS = 400;
const DESC_LONG_LINES = 6;

function DescriptionBody({ description }: { description: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > DESC_LONG_CHARS || description.split("\n").length > DESC_LONG_LINES;
  return (
    <>
      <p
        className={`whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere] ${
          isLong && !expanded ? "line-clamp-6" : ""
        }`}
      >
        {description}
      </p>
      {isLong && (
        <button
          type="button"
          className="mt-1.5 rounded-sm text-xs font-medium text-foreground transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("tickets.conversation.showLess") : t("tickets.conversation.showMore")}
        </button>
      )}
    </>
  );
}

function displayValue(value: string, t: TFunction) {
  if (["NEW", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "ESCALATED"].includes(value))
    return t(`tickets.status.${value}`);
  if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(value)) return t(`tickets.priority.${value}`);
  return value;
}
