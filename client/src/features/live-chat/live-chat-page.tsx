import { MessagesSquare, Paperclip, Wifi, WifiOff } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/skeleton";
import { AppSelectField } from "@/components/ui/app-select";
import { FileUploadModal } from "@/components/shared/file-upload";
import { ConversationMessage, ConversationSection } from "@/features/tickets/ticket-conversation-ui";
import { MessageAttachmentList } from "@/features/attachments/attachment-ui";
import { TicketReplyEditor, type TicketReplyEditorHandle } from "@/features/tickets/ticket-reply-editor";
import {
  usePortalTicketAttachments,
  useUploadPortalTicketAttachment,
} from "@/features/attachments/attachment-hooks";
import { usePortalTicket } from "@/features/portal/portal-hooks";
import { PortalPage, PortalStatus } from "@/features/portal/portal-ui";
import { useRealtimeStatus } from "@/features/realtime/realtime-status";
import type { RealtimeConnectionStatus } from "@/features/realtime/realtime.types";
import {
  useLiveChat,
  useLiveChatDepartments,
  useSendLiveChatMessage,
  useStartLiveChat,
} from "./live-chat-hooks";
import type { LiveChat } from "./live-chat.types";

/** Customer Portal → Live Chat. A live chat IS a LIVE_CHAT Ticket; this page is a
 * conversational surface over the shared portal ticket + realtime infrastructure. */
export function LiveChatPage() {
  const { t } = useTranslation();
  const bootstrap = useLiveChat();

  if (bootstrap.isLoading) {
    return (
      <PortalPage>
        <PageHeader title={t("liveChat.title")} description={t("liveChat.subtitle")} />
        <div data-testid="live-chat-skeleton" className="mt-4 space-y-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-[420px] w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </PortalPage>
    );
  }

  if (bootstrap.isError) {
    return (
      <PortalPage>
        <PageHeader title={t("liveChat.title")} description={t("liveChat.subtitle")} />
        <EmptyState
          className="mt-6"
          title={t("liveChat.loadError")}
          action={
            <button type="button" className="button-secondary" onClick={() => bootstrap.refetch()}>
              {t("common.retry")}
            </button>
          }
        />
      </PortalPage>
    );
  }

  const chat = bootstrap.data ?? null;

  if (!chat) {
    return (
      <PortalPage>
        <PageHeader title={t("liveChat.title")} description={t("liveChat.subtitle")} />
        <LiveChatStartCard />
      </PortalPage>
    );
  }

  return (
    <PortalPage>
      <LiveChatRoom chatId={chat.id} initial={chat} />
    </PortalPage>
  );
}

/**
 * The "start a live chat" screen shown only when the customer has no resumable
 * chat. The customer must pick a Department before pressing Start; the server
 * then resolves the Team and creates the LIVE_CHAT ticket already routed.
 */
function LiveChatStartCard() {
  const { t } = useTranslation();
  const departments = useLiveChatDepartments();
  const start = useStartLiveChat();
  const [departmentId, setDepartmentId] = useState("");

  const options = (departments.data ?? []).map((department) => ({
    value: department.id,
    label: department.name,
  }));
  const noDepartments = departments.isSuccess && options.length === 0;
  const canSubmit = Boolean(departmentId) && !start.isPending && !noDepartments;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    start.mutate(departmentId);
  };

  return (
    <section
      className="mt-6 overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-subtle"
      aria-label={t("liveChat.startTitle")}
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-secondary/50 text-muted-foreground">
            <MessagesSquare className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{t("liveChat.startTitle")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("liveChat.startBody")}</p>
          </div>
        </div>

        {departments.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-danger" role="alert">
              {t("liveChat.departmentsError")}
            </p>
            <button
              type="button"
              className="button-secondary"
              onClick={() => departments.refetch()}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <AppSelectField
              id="live-chat-department"
              label={t("liveChat.departmentLabel")}
              placeholder={
                departments.isLoading
                  ? t("common.loading")
                  : t("liveChat.departmentPlaceholder")
              }
              value={departmentId}
              onValueChange={setDepartmentId}
              options={options}
              disabled={departments.isLoading || noDepartments}
              helperText={noDepartments ? t("liveChat.noDepartments") : undefined}
            />

            <div className="flex flex-col gap-2">
              <button type="submit" className="button-primary w-full sm:w-auto" disabled={!canSubmit}>
                {start.isPending ? t("liveChat.starting") : t("liveChat.startAction")}
              </button>
              {start.isError && (
                <p className="text-sm text-danger" role="alert">
                  {t("liveChat.startError")}
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function ConnectionPill({ status }: { status: RealtimeConnectionStatus }) {
  const { t } = useTranslation();
  const online = status === "open";
  const reconnecting = status === "connecting" || status === "reconnecting";
  const label = online
    ? t("liveChat.connection.connected")
    : reconnecting
      ? t("liveChat.connection.reconnecting")
      : t("liveChat.connection.offline");
  const tone = online
    ? "border-success-soft bg-success-soft/40 text-success-foreground"
    : reconnecting
      ? "border-warning-soft bg-warning-soft/40 text-warning-foreground"
      : "border-border bg-surface-secondary text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
      role="status"
      aria-live="polite"
    >
      {online ? (
        <Wifi className="size-3.5" aria-hidden="true" />
      ) : (
        <WifiOff className="size-3.5" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

function LiveChatRoom({ chatId, initial }: { chatId: string; initial: LiveChat }) {
  const { t, i18n } = useTranslation();
  const status = useRealtimeStatus();
  // The canonical, database-backed history. Realtime invalidates this key, so the
  // conversation stays live without an in-memory message array being the truth.
  const detail = usePortalTicket(chatId);
  const chat = detail.data ?? initial;

  const send = useSendLiveChatMessage(chatId);
  const attachments = usePortalTicketAttachments(chatId);
  const upload = useUploadPortalTicketAttachment(chatId);

  const editorRef = useRef<TicketReplyEditorHandle>(null);
  const [text, setText] = useState("");
  const [sendToken, setSendToken] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);

  const readOnly = chat.status === "CLOSED";
  const reopens = chat.status === "RESOLVED";

  const messageAttachments = new Map<string, NonNullable<typeof attachments.data>>();
  for (const item of attachments.data ?? []) {
    if (item.messageId) {
      messageAttachments.set(item.messageId, [...(messageAttachments.get(item.messageId) ?? []), item]);
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (send.isPending || !editorRef.current?.hasText()) return;
    try {
      await send.mutateAsync(editorRef.current?.getHtml() ?? "");
      editorRef.current?.clear();
      setText("");
      setSendToken((token) => token + 1);
    } catch {
      /* surfaced via send.isError */
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={t("liveChat.title")}
        description={t("liveChat.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <PortalStatus status={chat.status} />
            <ConnectionPill status={status} />
          </div>
        }
      />

      {status !== "open" && (
        <p
          className="rounded-md border border-warning-soft bg-warning-soft/30 px-3 py-2 text-xs text-warning-foreground"
          role="status"
        >
          {t("liveChat.connection.banner")}
        </p>
      )}

      <div className="min-w-0 lg:h-[460px] lg:min-h-[360px] lg:max-h-[560px]">
        <ConversationSection
          bounded
          autoScrollItemCount={chat.messages.length}
          autoScrollSendToken={sendToken}
          heading={t("liveChat.conversationHeading")}
          countLabel={t("tickets.conversation.messageCount", { total: chat.messages.length })}
          timelineLabel={t("liveChat.timelineLabel")}
          isEmpty={chat.messages.length === 0}
          emptyTitle={t("liveChat.emptyTitle")}
          emptyDescription={t("liveChat.emptyBody")}
        >
          {chat.messages.map((message) => (
            <ConversationMessage
              key={message.id}
              side={message.author.kind === "CUSTOMER" ? "end" : "start"}
              maxWidthClass="w-fit max-w-[85%] sm:max-w-[min(70%,560px)]"
              title={t(`portal.author.${message.author.kind}`)}
              timestamp={message.createdAt}
              language={i18n.language}
              body={message.body}
              attachmentsSlot={
                <MessageAttachmentList attachments={messageAttachments.get(message.id) ?? []} scope="portal" />
              }
            />
          ))}
        </ConversationSection>
      </div>

      <section
        className="overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-subtle"
        aria-label={t("liveChat.composerLabel")}
      >
        <div className="p-4 sm:p-5">
          {readOnly ? (
            <p className="rounded-md border border-border bg-surface-secondary/40 p-3 text-sm text-muted-foreground">
              {t("liveChat.closedNotice")}
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{t("liveChat.composerHeading")}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground" id="live-chat-composer-help">
                  {t("liveChat.composerHelp")}
                </p>
              </div>
              {reopens && (
                <p className="rounded-md border border-primary/30 bg-primary-subtle p-2.5 text-xs text-primary sm:text-sm">
                  {t("liveChat.reopenNotice")}
                </p>
              )}
              <TicketReplyEditor
                ref={editorRef}
                id="live-chat-composer"
                ariaLabel={t("liveChat.composerLabel")}
                ariaDescribedBy="live-chat-composer-help"
                placeholder={t("liveChat.composerPlaceholder")}
                disabled={send.isPending}
                onTextChange={setText}
              />
              {send.isError && (
                <p className="text-sm text-danger" role="alert">
                  {t("liveChat.sendError")}
                </p>
              )}
              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="button-secondary inline-flex w-full items-center gap-1.5 sm:me-auto sm:w-auto"
                  onClick={() => setUploadOpen(true)}
                >
                  <Paperclip
                    className="size-4 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>{t("attachments.attachFile")}</span>
                </button>
                <button
                  type="submit"
                  className="button-primary sm:ms-auto sm:w-auto"
                  disabled={send.isPending || !text.trim()}
                >
                  {send.isPending ? t("liveChat.sending") : t("liveChat.send")}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <FileUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={(file) => upload.mutateAsync(file)}
        isUploading={upload.isPending}
      />
    </div>
  );
}
