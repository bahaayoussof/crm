import { MessagesSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConversationMessage } from "@/features/tickets/ticket-conversation-ui";
import { usePortalTicket } from "@/features/portal/portal-hooks";
import { useSendLiveChatMessage } from "@/features/live-chat/live-chat-hooks";
import type { LiveChat } from "@/features/live-chat/live-chat.types";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

/**
 * Customer Live Chat body rendered inside the shared {@link SupportWidget}. It is
 * the human-conversation counterpart to `CustomerAiChat`: same compact panel
 * layout (scrollable conversation + bottom composer), but the messages come from
 * the canonical portal ticket (`usePortalTicket`) and the send path is the
 * existing `useSendLiveChatMessage` — no new endpoint, no parallel message
 * store. Ending the chat and the confirmation live in the widget coordinator so
 * the "End chat" control can sit in the shared header.
 */
export function CustomerLiveChat({ chatId, initial }: { chatId: string; initial: LiveChat }) {
  const { t, i18n } = useTranslation();
  const detail = usePortalTicket(chatId);
  const chat = detail.data ?? initial;
  const send = useSendLiveChatMessage(chatId);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLLIElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const readOnly = chat.status === "CLOSED";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [chat.messages.length, send.isPending]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate(`<p>${escapeHtml(body)}</p>`, { onSuccess: () => setDraft("") });
  };

  return <>
    <ol className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite" aria-label={t("liveChat.conversationHeading")}>
      {chat.messages.length === 0 && <li className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 py-8 text-center">
        <MessagesSquare className="size-7 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{t("liveChat.emptyTitle")}</h3>
        <p className="max-w-[15rem] text-xs text-muted-foreground">{t("liveChat.emptyBody")}</p>
      </li>}
      {chat.messages.map((message) => <ConversationMessage
        key={message.id}
        side={message.author.kind === "CUSTOMER" ? "end" : "start"}
        maxWidthClass="max-w-[90%]"
        title={t(`portal.author.${message.author.kind}`)}
        timestamp={message.createdAt}
        language={i18n.language}
        body={message.body}
      />)}
      {send.isError && <li role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger-foreground">{t("liveChat.sendError")}</li>}
      <li ref={endRef} aria-hidden="true" />
    </ol>
    {readOnly ? (
      <p className="shrink-0 border-t border-border bg-card p-3 text-sm text-muted-foreground">{t("liveChat.closedNotice")}</p>
    ) : (
      <form className="flex shrink-0 items-end gap-2 border-t border-border bg-card p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label className="sr-only" htmlFor="customer-live-chat-message">{t("liveChat.composerPlaceholder")}</label>
        <textarea
          ref={textareaRef}
          id="customer-live-chat-message"
          rows={1}
          maxLength={2000}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-border bg-surface px-3.5 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-border-strong focus:border-ring focus:ring-2 focus:ring-ring/15"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }}
          placeholder={t("liveChat.composerPlaceholder")}
        />
        <button
          type="submit"
          aria-label={t("liveChat.send")}
          title={t("liveChat.send")}
          disabled={!draft.trim() || send.isPending}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition hover:bg-primary-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-4 shrink-0" aria-hidden="true" />
        </button>
      </form>
    )}
  </>;
}
