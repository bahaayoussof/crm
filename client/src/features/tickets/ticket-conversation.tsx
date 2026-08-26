import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageAttachmentList } from "@/features/attachments/attachment-ui";
import { QuickReplyPicker } from "@/features/quick-replies/quick-reply-picker";
import { getTicketError } from "./ticket-error";
import { formatTicketDate } from "./ticket-format";
import { useCreateTicketMessage, useCreateTicketNote } from "./ticket-hooks";
import type { TicketConversationItem } from "./ticket.types";

type Mode = "reply" | "note";
type MessageAttachment = { id: string; fileName: string; mimeType: string; createdAt: string };

// Matches the server public-reply limit (`ticketConversationBodySchema` / `portalReplySchema`: body max 20_000).
const MAX_PUBLIC_REPLY_LENGTH = 20_000;

export function TicketConversation({ ticketId, items, canMutate, messageAttachments }: { ticketId: string; items: TicketConversationItem[]; canMutate: boolean; messageAttachments?: Map<string, MessageAttachment[]> }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("reply");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [insertError, setInsertError] = useState<string | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const messageMutation = useCreateTicketMessage(ticketId);
  const noteMutation = useCreateTicketNote(ticketId);
  const mutation = mode === "reply" ? messageMutation : noteMutation;
  const body = mode === "reply" ? reply : note;
  const pending = messageMutation.isPending || noteMutation.isPending;

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    pendingCaretRef.current = null;
    const element = replyRef.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(caret, caret);
  }, [reply]);

  const insertQuickReply = (snippet: string) => {
    const element = replyRef.current;
    const start = element?.selectionStart ?? reply.length;
    const end = element?.selectionEnd ?? reply.length;
    const before = reply.slice(0, start);
    const after = reply.slice(end);
    const leading = before !== "" && !/\s$/.test(before) ? "\n\n" : "";
    const trailing = after !== "" && !/^\s/.test(after) ? "\n\n" : "";
    const inserted = `${leading}${snippet}${trailing}`;
    const next = `${before}${inserted}${after}`;
    if (next.length > MAX_PUBLIC_REPLY_LENGTH) {
      setInsertError(t("quickReplies.picker.lengthExceeded"));
      return;
    }
    setInsertError(null);
    pendingCaretRef.current = before.length + leading.length + snippet.length;
    setReply(next);
  };

  const submit = async () => {
    if (!canMutate || !body.trim() || pending) return;
    setError(null); setSuccess(null);
    try {
      await mutation.mutateAsync({ body });
      if (mode === "reply") setReply(""); else setNote("");
      setSuccess(t(mode === "reply" ? "tickets.conversation.replySuccess" : "tickets.conversation.noteSuccess"));
    } catch (caught) {
      setError(getTicketError(caught, t(mode === "reply" ? "tickets.conversation.replyError" : "tickets.conversation.noteError"), t));
    }
  };
  return <section className="overflow-hidden rounded-md border bg-white" aria-labelledby="ticket-conversation-heading">
    <div className="border-b px-5 py-4"><h2 className="text-base font-semibold" id="ticket-conversation-heading">{t("tickets.conversation.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("tickets.conversation.description")}</p></div>
    <div className="min-h-48 px-4 py-2 sm:px-5">
      {items.length ? <ol className="space-y-4 py-2" aria-label={t("tickets.conversation.timelineLabel")}>{items.map((item) => <ConversationItem item={item} key={`${item.kind}-${item.id}`} attachments={item.kind === "PUBLIC_MESSAGE" ? messageAttachments?.get(item.id) ?? [] : []} />)}</ol> : <div className="flex min-h-44 flex-col items-center justify-center text-center"><p className="text-sm font-medium">{t("tickets.conversation.emptyTitle")}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{t("tickets.conversation.emptyDescription")}</p></div>}
    </div>
    <div className="border-t bg-muted/20 p-4 sm:p-5">
      <div className="flex w-full border-b" role="tablist" aria-label={t("tickets.conversation.composerMode")}>{(["reply", "note"] as Mode[]).map((value) => <button type="button" role="tab" aria-selected={mode === value} aria-controls="conversation-composer-panel" className={`min-h-11 border-b-2 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => { setMode(value); setError(null); setSuccess(null); setInsertError(null); }} key={value}>{t(`tickets.conversation.${value}Tab`)}</button>)}</div>
      <div className="pt-4" id="conversation-composer-panel" role="tabpanel">
        <label className="text-sm font-medium" htmlFor={`conversation-${mode}`}>{t(mode === "reply" ? "tickets.conversation.replyLabel" : "tickets.conversation.noteLabel")}</label>
        <p className="mt-1 text-xs text-muted-foreground" id={`conversation-${mode}-help`}>{t(mode === "reply" ? "tickets.conversation.replyHelp" : "tickets.conversation.noteHelp")}</p>
        <textarea ref={mode === "reply" ? replyRef : undefined} id={`conversation-${mode}`} className="input mt-3 min-h-28 resize-y py-3" value={body} disabled={!canMutate || pending} aria-describedby={`conversation-${mode}-help`} onChange={(event) => { if (mode === "reply") { setReply(event.target.value); setInsertError(null); } else setNote(event.target.value); }} />
        {!canMutate && <p className="mt-2 text-sm text-amber-800" role="status">{t("tickets.conversation.readOnly")}</p>}
        {insertError && <p className="mt-2 text-sm text-red-700" role="alert">{insertError}</p>}
        {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-700" role="status">{success}</p>}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          {mode === "reply" && canMutate && <QuickReplyPicker disabled={pending} onSelect={insertQuickReply} />}
          <button type="button" className="button-primary sm:ms-auto sm:w-auto" disabled={!canMutate || !body.trim() || pending} onClick={submit}>{pending ? t(mode === "reply" ? "tickets.conversation.sending" : "tickets.conversation.adding") : t(mode === "reply" ? "tickets.conversation.sendReply" : "tickets.conversation.addNote")}</button>
        </div>
      </div>
    </div>
  </section>;
}

// Progressive disclosure for genuinely long messages. Deterministic threshold
// (documented in docs/18): collapse only when the body exceeds ~10 lines or 800
// characters; the complete text always stays in the DOM.
const LONG_MESSAGE_LINES = 10;
const LONG_MESSAGE_CHARS = 800;

function MessageBody({ body }: { body: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > LONG_MESSAGE_CHARS || body.split("\n").length > LONG_MESSAGE_LINES;
  return <div className="mt-2">
    <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 ${isLong && !expanded ? "line-clamp-[10]" : ""}`}>{body}</p>
    {isLong && <button
      type="button"
      className="mt-1.5 rounded-sm text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      aria-expanded={expanded}
      onClick={() => setExpanded((value) => !value)}
    >{expanded ? t("tickets.conversation.showLess") : t("tickets.conversation.showMore")}</button>}
  </div>;
}

function ConversationItem({ item, attachments }: { item: TicketConversationItem; attachments: MessageAttachment[] }) {
  const { t, i18n } = useTranslation();
  const internal = item.kind === "INTERNAL_NOTE";
  const fromCustomer = item.author.role === "CUSTOMER";
  // Internal notes and customer messages sit at the logical start; staff public
  // replies at the logical end. Flexbox `justify-*` flips naturally under RTL.
  const align = internal || fromCustomer ? "justify-start" : "justify-end";
  return <li className={`flex ${align}`}>
    <article className={`min-w-0 max-w-full rounded-md border px-4 py-3 sm:max-w-[min(85%,46rem)] ${internal ? "border-amber-200 bg-amber-50/70" : "border-border bg-white"}`}>
      <header className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-sm font-semibold" dir="auto">{item.author.name}</span>
          <span className="text-xs text-muted-foreground">{t(`tickets.conversation.roles.${item.author.role}`, { defaultValue: item.author.role })}</span>
          {internal && <span className="rounded-sm border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{t("tickets.conversation.internalLabel")}</span>}
        </div>
        <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground" dir="ltr" dateTime={item.createdAt}>{formatTicketDate(item.createdAt, i18n.language)}</time>
      </header>
      <MessageBody body={item.body} />
      {!internal && <MessageAttachmentList attachments={attachments} scope="internal" />}
      {!internal && <p className="mt-2 text-xs text-muted-foreground">{t("tickets.conversation.publicLabel")}</p>}
    </article>
  </li>;
}
