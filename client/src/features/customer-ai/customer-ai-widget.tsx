import axios from "axios";
import { Bot, Send, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useCustomerAiChat, useCustomerAiHandoff } from "./customer-ai-hooks";
import type { CustomerAiMessage, CustomerAiResponse } from "./customer-ai.types";
import { SupportWidget } from "./support-widget";

type DisplayMessage = CustomerAiMessage & { response?: CustomerAiResponse };

function errorCode(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.data?.error?.code as string | undefined : undefined;
}

/**
 * Customer AI Chat — the AI channel rendered inside the shared, non-modal
 * {@link SupportWidget}. This module owns all AI-specific concerns (chat/handoff
 * hooks, grounded article links, rate-limit + provider-failure UX, bounded
 * history). Conversation state is local React state, so it survives Portal
 * route navigation while the widget stays mounted in `AppShell`.
 */
export function CustomerAiWidget() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLLIElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(searchParams.get("support") === "ai");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [failedMessage, setFailedMessage] = useState("");
  const chat = useCustomerAiChat();
  const handoff = useCustomerAiHandoff();

  useEffect(() => {
    if (searchParams.get("support") !== "ai") return;
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("support");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, open, chat.isPending]);

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

  return (
    <SupportWidget
      open={open}
      onOpenChange={setOpen}
      title={t("customerAi.title")}
      launcherLabel={t("customerAi.open")}
      closeLabel={t("customerAi.close")}
      launcherIcon={<Bot className="size-6" aria-hidden="true" />}
    >
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
    </SupportWidget>
  );
}
