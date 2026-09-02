import axios from "axios";
import { ArrowLeft, Bot, LogOut, MessagesSquare, Send, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Modal } from "@/components/ui/modal";
import { useEndLiveChat, useLiveChat } from "@/features/live-chat/live-chat-hooks";
import { isTerminalLiveChat } from "@/features/live-chat/live-chat.types";
import { useRealtimeStatus } from "@/features/realtime/realtime-status";
import { useCustomerAiChat, useCustomerAiHandoff } from "./customer-ai-hooks";
import { CustomerLiveChat, LiveChatStart } from "./customer-live-chat";
import { SupportWidget } from "./support-widget";
import type { CustomerAiMessage, CustomerAiResponse } from "./customer-ai.types";

type DisplayMessage = CustomerAiMessage & { response?: CustomerAiResponse };

/** UI presentation channel. It is *only* presentation — switching never starts or
 * ends anything. AI history and any active Live Chat both survive a switch. */
type Channel = "ai" | "live";

function errorCode(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.data?.error?.code as string | undefined : undefined;
}

/** Small live-connection indicator for the Live Chat header (● Connected). */
function ConnectionDot() {
  const { t } = useTranslation();
  const status = useRealtimeStatus();
  const online = status === "open";
  return (
    <span
      role="status"
      className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${online ? "text-success-foreground" : "text-muted-foreground"}`}
    >
      <span className={`size-1.5 rounded-full ${online ? "bg-success" : "bg-muted-foreground"}`} aria-hidden="true" />
      {online ? t("liveChat.connection.connected") : t("liveChat.connection.reconnecting")}
    </span>
  );
}

/**
 * The customer's single floating support widget. It owns the shared, non-modal
 * {@link SupportWidget} shell and coordinates which channel body renders inside:
 *
 *  - **AI** (default) — all AI state lives here so the conversation survives
 *    Portal route navigation and close/reopen while the widget stays mounted. A
 *    persistent "Talk to a person" header action escalates to Live Chat.
 *  - **Live** — {@link CustomerLiveChat} for an active human chat (resumed via
 *    the existing `useLiveChat` bootstrap), or {@link LiveChatStart} for the
 *    compact Department picker when none exists. "End chat" is a header action,
 *    Live-only, and runs the existing `useEndLiveChat` lifecycle behind the
 *    shared confirmation {@link Modal}.
 *
 * `X` only minimizes the widget; it never ends a conversation. Switching channel
 * is presentation state only.
 */
export function CustomerAiWidget() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLLIElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supportParam = searchParams.get("support");
  const [open, setOpen] = useState(supportParam === "ai" || supportParam === "live");
  const [channel, setChannel] = useState<Channel>(supportParam === "live" ? "live" : "ai");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [failedMessage, setFailedMessage] = useState("");
  const chat = useCustomerAiChat();
  const handoff = useCustomerAiHandoff();

  // Live Chat awareness. A RESOLVED/CLOSED bootstrap is not resumable.
  const liveChatBootstrap = useLiveChat();
  const activeLiveChat = liveChatBootstrap.data && !isTerminalLiveChat(liveChatBootstrap.data.status)
    ? liveChatBootstrap.data
    : null;
  const [justEndedLiveChat, setJustEndedLiveChat] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const endLiveChat = useEndLiveChat(activeLiveChat?.id ?? "");

  // When a Live Chat becomes active (started here, or already open on load),
  // surface it. A later "Back to AI" sets channel back to "ai" and stays there
  // (the chat keeps running) because this only fires on the false -> true edge.
  const hadActiveLiveChat = useRef(false);
  useEffect(() => {
    if (activeLiveChat && !hadActiveLiveChat.current) setChannel("live");
    hadActiveLiveChat.current = Boolean(activeLiveChat);
  }, [activeLiveChat]);

  useEffect(() => {
    if (supportParam !== "ai" && supportParam !== "live") return;
    setOpen(true);
    setChannel(supportParam === "live" ? "live" : "ai");
    const next = new URLSearchParams(searchParams);
    next.delete("support");
    setSearchParams(next, { replace: true });
  }, [supportParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (open && channel === "ai") messagesEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, open, channel, chat.isPending]);

  // Auto-grow the composer to a bounded maximum; resets when the draft clears.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

  const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
  const send = (retryMessage?: string) => {
    const message = (retryMessage ?? draft).trim();
    if (!message || chat.isPending) return;
    setMessages((current) => [...current, { role: "user", content: message }]);
    setDraft("");
    setFailedMessage("");
    chat.mutate({ message, history, locale: i18n.language.startsWith("ar") ? "ar" : "en" }, {
      onSuccess: (response) => setMessages((current) => [...current, { role: "assistant", content: response.answer, response }]),
      onError: () => setFailedMessage(message),
    });
  };
  const requestHandoff = (fallback: string) => handoff.mutate({
    message: messages.filter((message) => message.role === "user").at(-1)?.content || fallback,
    history: messages.slice(-8).map(({ role, content }) => ({ role, content })),
  });

  const confirmEndLiveChat = async () => {
    if (endLiveChat.isPending || !activeLiveChat) return;
    try {
      await endLiveChat.mutateAsync();
      setConfirmEndOpen(false);
      setJustEndedLiveChat(true);
    } catch {
      /* surfaced via endLiveChat.isError */
    }
  };
  const startNewLiveChat = () => {
    setJustEndedLiveChat(false);
    void liveChatBootstrap.refetch();
  };

  const liveView: "active" | "ended" | "selecting" = justEndedLiveChat
    ? "ended"
    : activeLiveChat
      ? "active"
      : "selecting";

  const backToAi = (
    <button
      type="button"
      onClick={() => setChannel("ai")}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <ArrowLeft className="size-3.5 shrink-0 [[dir=rtl]_&]:-scale-x-100" aria-hidden="true" />
      {t("liveChat.backToAi")}
    </button>
  );

  return (
    <SupportWidget
      open={open}
      onOpenChange={setOpen}
      title={channel === "ai" ? t("customerAi.title") : t("liveChat.liveSupport")}
      launcherLabel={t("customerAi.open")}
      closeLabel={t("customerAi.close")}
      launcherIcon={<Bot className="size-6" aria-hidden="true" />}
      headerAction={channel === "ai" ? (
        <button
          type="button"
          onClick={() => setChannel("live")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-transparent px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
          {t("liveChat.talkToPerson")}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          {liveView === "active" && <ConnectionDot />}
          {backToAi}
          {liveView === "active" && (
            <button
              type="button"
              onClick={() => setConfirmEndOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-danger-soft bg-transparent px-2 py-1 text-xs font-medium text-danger-foreground transition hover:border-danger/30 hover:bg-danger-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
            >
              <LogOut className="size-3.5 shrink-0" aria-hidden="true" />
              {t("liveChat.endAction")}
            </button>
          )}
        </div>
      )}
    >
      {channel === "live" && liveView === "active" && activeLiveChat && (
        <CustomerLiveChat chatId={activeLiveChat.id} initial={activeLiveChat} onStartNew={startNewLiveChat} />
      )}

      {channel === "live" && liveView === "selecting" && <LiveChatStart />}

      {channel === "live" && liveView === "ended" && <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <MessagesSquare className="size-7 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{t("liveChat.endedTitle")}</h3>
        <p className="max-w-[16rem] text-xs text-muted-foreground">{t("liveChat.endedBody")}</p>
        <button type="button" className="button-primary !w-auto" onClick={startNewLiveChat}>{t("liveChat.startNewChat")}</button>
      </div>}

      {channel === "ai" && <>
        <p className="shrink-0 border-b border-border bg-surface-secondary px-4 py-2 text-xs text-muted-foreground">{t("customerAi.disclosure")}</p>
        <ol className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite" aria-label={t("customerAi.conversation")}>
          {messages.length === 0 && <li className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 py-8 text-center">
            <Bot className="size-7 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold">{t("customerAi.emptyTitle")}</h3>
            <p className="max-w-[15rem] text-xs text-muted-foreground">{t("customerAi.emptyBody")}</p>
          </li>}
          {messages.map((item, index) => <li key={index} className={`flex gap-2 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
            {item.role === "assistant" && <Bot className="mt-2 size-4.5 shrink-0 text-primary" aria-hidden="true" />}
            <div className={`max-w-[85%] rounded-lg px-3 py-2.5 text-sm ${item.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-surface"}`}>
              <p className="whitespace-pre-wrap break-words">{item.content}</p>
              {item.response?.suggestedArticles.length ? <div className="mt-3 border-t border-border pt-3"><p className="mb-2 font-medium">{t("customerAi.suggestedArticles")}</p><ul className="space-y-2">{item.response.suggestedArticles.map((article) => <li key={article.id}><Link className="text-primary underline-offset-4 hover:underline" to={`/portal/knowledge-base/${article.id}`}>{article.title}</Link>{article.category && <span className="ms-2 text-xs text-muted-foreground">{article.category}</span>}<p className="mt-0.5 text-xs text-muted-foreground">{article.excerpt}</p></li>)}</ul></div> : null}
              {item.response?.canHandoff && !handoff.isSuccess && <button type="button" className="button-secondary mt-3" disabled={handoff.isPending} onClick={() => requestHandoff(item.content)}>{handoff.isPending ? t("customerAi.creatingTicket") : t("customerAi.handoff")}</button>}
            </div>
            {item.role === "user" && <UserRound className="mt-2 size-4.5 shrink-0" aria-hidden="true" />}
          </li>)}
          {chat.isPending && <li role="status" className="text-sm text-muted-foreground">{t("customerAi.thinking")}</li>}
          {chat.isError && <li role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger-foreground">{t(errorCode(chat.error) === "RATE_LIMITED" ? "customerAi.rateLimited" : "customerAi.error")} <button type="button" className="font-medium underline" onClick={() => send(failedMessage)}>{t("common.retry")}</button> {!handoff.isSuccess && <button type="button" className="ms-2 font-medium underline" disabled={handoff.isPending} onClick={() => requestHandoff(failedMessage)}>{t("customerAi.handoff")}</button>}</li>}
          {handoff.isSuccess && <li role="status" className="rounded-md bg-success-soft p-3 text-sm text-success-foreground">{t("customerAi.ticketCreated")} <Link className="font-medium underline" to={`/portal/tickets/${handoff.data.id}`}>{t("customerAi.openTicket")}</Link></li>}
          {handoff.isError && <li role="alert" className="text-sm text-danger-foreground">{t("customerAi.handoffError")}</li>}
          <li ref={messagesEndRef} aria-hidden="true" />
        </ol>
        <form className="flex shrink-0 items-end gap-2 border-t border-border bg-card p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <label className="sr-only" htmlFor="customer-ai-message">{t("customerAi.placeholder")}</label>
          <textarea
            ref={textareaRef}
            id="customer-ai-message"
            rows={1}
            maxLength={2000}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-border bg-surface px-3.5 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-border-strong focus:border-ring focus:ring-2 focus:ring-ring/15"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }}
            placeholder={t("customerAi.placeholder")}
          />
          <button
            type="submit"
            aria-label={t("customerAi.send")}
            title={t("customerAi.send")}
            disabled={!draft.trim() || chat.isPending}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition hover:bg-primary-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </form>
      </>}

      <Modal
        open={confirmEndOpen}
        onOpenChange={(next) => { if (!endLiveChat.isPending) setConfirmEndOpen(next); }}
        title={t("liveChat.endConfirmTitle")}
        description={t("liveChat.endConfirmBody")}
        maxWidth="sm"
      >
        <div className="space-y-3">
          {endLiveChat.isError && <p className="text-sm text-danger" role="alert">{t("liveChat.endError")}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="button-secondary" onClick={() => setConfirmEndOpen(false)} disabled={endLiveChat.isPending}>{t("liveChat.endCancel")}</button>
            <button type="button" className="button-danger" onClick={confirmEndLiveChat} disabled={endLiveChat.isPending}>{endLiveChat.isPending ? t("liveChat.ending") : t("liveChat.endAction")}</button>
          </div>
        </div>
      </Modal>
    </SupportWidget>
  );
}
