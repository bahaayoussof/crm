import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getTicketError } from "./ticket-error";
import { formatTicketDate } from "./ticket-format";
import { useCreateTicketMessage, useCreateTicketNote } from "./ticket-hooks";
import type { TicketConversationItem } from "./ticket.types";

type Mode = "reply" | "note";

export function TicketConversation({ ticketId, items, canMutate }: { ticketId: string; items: TicketConversationItem[]; canMutate: boolean }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("reply");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const messageMutation = useCreateTicketMessage(ticketId);
  const noteMutation = useCreateTicketNote(ticketId);
  const mutation = mode === "reply" ? messageMutation : noteMutation;
  const body = mode === "reply" ? reply : note;
  const pending = messageMutation.isPending || noteMutation.isPending;
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
      {items.length ? <ol className="divide-y" aria-label={t("tickets.conversation.timelineLabel")}>{items.map((item) => <ConversationItem item={item} key={`${item.kind}-${item.id}`} />)}</ol> : <div className="flex min-h-44 flex-col items-center justify-center text-center"><p className="text-sm font-medium">{t("tickets.conversation.emptyTitle")}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{t("tickets.conversation.emptyDescription")}</p></div>}
    </div>
    <div className="border-t bg-muted/20 p-4 sm:p-5">
      <div className="flex w-full border-b" role="tablist" aria-label={t("tickets.conversation.composerMode")}>{(["reply", "note"] as Mode[]).map((value) => <button type="button" role="tab" aria-selected={mode === value} aria-controls="conversation-composer-panel" className={`min-h-11 border-b-2 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => { setMode(value); setError(null); setSuccess(null); }} key={value}>{t(`tickets.conversation.${value}Tab`)}</button>)}</div>
      <div className="pt-4" id="conversation-composer-panel" role="tabpanel">
        <label className="text-sm font-medium" htmlFor={`conversation-${mode}`}>{t(mode === "reply" ? "tickets.conversation.replyLabel" : "tickets.conversation.noteLabel")}</label>
        <p className="mt-1 text-xs text-muted-foreground" id={`conversation-${mode}-help`}>{t(mode === "reply" ? "tickets.conversation.replyHelp" : "tickets.conversation.noteHelp")}</p>
        <textarea id={`conversation-${mode}`} className="input mt-3 min-h-28 resize-y py-3" value={body} disabled={!canMutate || pending} aria-describedby={`conversation-${mode}-help`} onChange={(event) => mode === "reply" ? setReply(event.target.value) : setNote(event.target.value)} />
        {!canMutate && <p className="mt-2 text-sm text-amber-800" role="status">{t("tickets.conversation.readOnly")}</p>}
        {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-700" role="status">{success}</p>}
        <div className="mt-3 flex justify-end"><button type="button" className="button-primary" disabled={!canMutate || !body.trim() || pending} onClick={submit}>{pending ? t(mode === "reply" ? "tickets.conversation.sending" : "tickets.conversation.adding") : t(mode === "reply" ? "tickets.conversation.sendReply" : "tickets.conversation.addNote")}</button></div>
      </div>
    </div>
  </section>;
}

function ConversationItem({ item }: { item: TicketConversationItem }) {
  const { t, i18n } = useTranslation(); const internal = item.kind === "INTERNAL_NOTE";
  return <li className="py-4"><article className={internal ? "rounded-md border border-amber-200 bg-amber-50/70 p-4" : "px-1 py-2"}>
    <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{item.author.name}</span><span className="text-xs text-muted-foreground">{t(`tickets.conversation.roles.${item.author.role}`, { defaultValue: item.author.role })}</span>{internal && <span className="rounded-sm border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{t("tickets.conversation.internalLabel")}</span>}</div><time className="text-xs text-muted-foreground" dir="ltr" dateTime={item.createdAt}>{formatTicketDate(item.createdAt, i18n.language)}</time></header>
    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{item.body}</p>
    {!internal && <p className="mt-2 text-xs text-muted-foreground">{t("tickets.conversation.publicLabel")}</p>}
  </article></li>;
}
