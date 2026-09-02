import { MessagesSquare, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppSelectField } from "@/components/ui/app-select";
import { ConversationMessage } from "@/features/tickets/ticket-conversation-ui";
import { usePortalTicket } from "@/features/portal/portal-hooks";
import { useRealtimeStatus } from "@/features/realtime/realtime-status";
import {
  useLiveChatDepartments,
  useSendLiveChatMessage,
  useStartLiveChat,
} from "@/features/live-chat/live-chat-hooks";
import {
  LIVE_CHAT_INACTIVITY_LIMIT_MS,
  LIVE_CHAT_INACTIVITY_WARNING_MS,
  type LiveChat,
} from "@/features/live-chat/live-chat.types";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

/**
 * Compact "choose a department, then start" screen shown inside the shared
 * {@link SupportWidget} when the customer asked for a human but has no resumable
 * Live Chat. Reuses the existing `useLiveChatDepartments` + `useStartLiveChat`
 * hooks and the canonical start-chat mutation — no routing logic in the client,
 * no navigation to a separate page.
 */
export function LiveChatStart() {
  const { t } = useTranslation();
  const departments = useLiveChatDepartments();
  const start = useStartLiveChat();
  const [departmentId, setDepartmentId] = useState("");

  const options = (departments.data ?? []).map((department) => ({ value: department.id, label: department.name }));
  const noDepartments = departments.isSuccess && options.length === 0;
  const canSubmit = Boolean(departmentId) && !start.isPending && !noDepartments;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-secondary/50 text-muted-foreground">
          <MessagesSquare className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{t("liveChat.startTitle")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("liveChat.startBody")}</p>
        </div>
      </div>

      {departments.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-danger" role="alert">{t("liveChat.departmentsError")}</p>
          <button type="button" className="button-secondary !w-auto" onClick={() => departments.refetch()}>{t("common.retry")}</button>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => { event.preventDefault(); if (canSubmit) start.mutate(departmentId); }}
        >
          <AppSelectField
            id="widget-live-chat-department"
            label={t("liveChat.departmentLabel")}
            placeholder={departments.isLoading ? t("common.loading") : t("liveChat.departmentPlaceholder")}
            value={departmentId}
            onValueChange={setDepartmentId}
            options={options}
            disabled={departments.isLoading || noDepartments}
            helperText={noDepartments ? t("liveChat.noDepartments") : undefined}
          />
          <button type="submit" className="button-primary w-full" disabled={!canSubmit}>
            {start.isPending ? t("liveChat.starting") : t("liveChat.startAction")}
          </button>
          {start.isError && <p className="text-sm text-danger" role="alert">{t("liveChat.startError")}</p>}
        </form>
      )}
    </div>
  );
}

/**
 * Customer Live Chat body rendered inside the shared {@link SupportWidget}. It is
 * the human-conversation counterpart to the AI channel: same compact panel
 * layout (scrollable conversation + bottom composer), but the messages come from
 * the canonical portal ticket (`usePortalTicket`) and the send path is the
 * existing `useSendLiveChatMessage` — no new endpoint, no parallel message
 * store. Ending the chat and its confirmation live in the widget coordinator so
 * the "End chat" control can sit in the shared header.
 *
 * A RESOLVED chat (staff resolve or the inactivity sweep) shows the terminal
 * card with "Start new chat"; a CLOSED chat is read-only.
 */
export function CustomerLiveChat({ chatId, initial, onStartNew }: { chatId: string; initial: LiveChat; onStartNew: () => void }) {
  const { t, i18n } = useTranslation();
  const detail = usePortalTicket(chatId);
  const chat = detail.data ?? initial;
  const send = useSendLiveChatMessage(chatId);
  const status = useRealtimeStatus();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLLIElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resolved = chat.status === "RESOLVED";
  const closed = chat.status === "CLOSED";
  const conversational = !resolved && !closed;

  // Advisory-only inactivity warning (client-side). The authoritative 30-minute
  // auto-resolve is server-owned; this just flags "may close soon" once a staff
  // reply exists and the newest message is 25–30 min old.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!conversational) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [conversational]);
  const showInactivityWarning = useMemo(() => {
    if (!conversational) return false;
    const last = chat.messages[chat.messages.length - 1];
    if (!last) return false;
    const hasStaffReply = chat.messages.some((message) => message.author.kind === "SUPPORT");
    const idleMs = nowMs - new Date(last.createdAt).getTime();
    return hasStaffReply && idleMs >= LIVE_CHAT_INACTIVITY_WARNING_MS && idleMs < LIVE_CHAT_INACTIVITY_LIMIT_MS;
  }, [conversational, chat.messages, nowMs]);

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

  if (resolved) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <MessagesSquare className="size-7 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{t("liveChat.endedTitle")}</h3>
        <p className="max-w-[16rem] text-xs text-muted-foreground">{t("liveChat.endedBody")}</p>
        <button type="button" className="button-primary !w-auto" onClick={onStartNew}>{t("liveChat.startNewChat")}</button>
      </div>
    );
  }

  return <>
    {status !== "open" && (
      <p className="shrink-0 border-b border-border bg-warning-soft/30 px-4 py-2 text-xs text-warning-foreground" role="status">
        {t("liveChat.connection.banner")}
      </p>
    )}
    {showInactivityWarning && (
      <p className="shrink-0 border-b border-border bg-warning-soft/30 px-4 py-2 text-xs text-warning-foreground" role="status">
        {t("liveChat.inactivityWarning")}
      </p>
    )}
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
    {closed ? (
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
