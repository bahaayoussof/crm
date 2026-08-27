import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageAttachmentList } from "@/features/attachments/attachment-ui";
import { QuickReplyPicker } from "@/features/quick-replies/quick-reply-picker";
import { ConversationMessage, ConversationSection } from "./ticket-conversation-ui";
import { getTicketError } from "./ticket-error";
import { useCreateTicketMessage, useCreateTicketNote } from "./ticket-hooks";
import type { TicketConversationItem } from "./ticket.types";

type Mode = "reply" | "note";
type MessageAttachment = { id: string; fileName: string; mimeType: string; createdAt: string };

// Matches the server public-reply limit (`ticketConversationBodySchema` / `portalReplySchema`: body max 20_000).
const MAX_PUBLIC_REPLY_LENGTH = 20_000;

export function TicketConversation({ ticketId, items, canMutate, messageAttachments }: { ticketId: string; items: TicketConversationItem[]; canMutate: boolean; messageAttachments?: Map<string, MessageAttachment[]> }) {
  const { t, i18n } = useTranslation();
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

  const composer = (
    <>
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
    </>
  );

  return (
    <ConversationSection
      heading={t("tickets.conversation.title")}
      description={t("tickets.conversation.description")}
      timelineLabel={t("tickets.conversation.timelineLabel")}
      isEmpty={items.length === 0}
      emptyTitle={t("tickets.conversation.emptyTitle")}
      emptyDescription={t("tickets.conversation.emptyDescription")}
      footer={composer}
    >
      {items.map((item) => {
        const internal = item.kind === "INTERNAL_NOTE";
        const fromCustomer = item.author.role === "CUSTOMER";
        return (
          <ConversationMessage
            key={`${item.kind}-${item.id}`}
            side={internal || fromCustomer ? "start" : "end"}
            tone={internal ? "internal" : "default"}
            title={item.author.name}
            meta={t(`tickets.conversation.roles.${item.author.role}`, { defaultValue: item.author.role })}
            badge={internal ? t("tickets.conversation.internalLabel") : undefined}
            footnote={internal ? undefined : t("tickets.conversation.publicLabel")}
            timestamp={item.createdAt}
            language={i18n.language}
            body={item.body}
            attachmentsSlot={internal ? undefined : <MessageAttachmentList attachments={messageAttachments?.get(item.id) ?? []} scope="internal" />}
          />
        );
      })}
    </ConversationSection>
  );
}
