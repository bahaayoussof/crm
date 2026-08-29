import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/features/auth/auth-state";
import { useTicketAttachments, useUploadTicketAttachment } from "@/features/attachments/attachment-hooks";
import { AiAssistantPanel } from "@/features/ai-assistant/ai-assistant-panel";
import type { CategoryApplyApi, ReplyInsertionApi } from "@/features/ai-assistant/ai-assistant.types";
import { TicketContextSummary } from "./ticket-context-summary";
import { TicketPriorityText, TicketStatusBadge } from "./ticket-badges";
import { TicketConversation } from "./ticket-conversation";
import { TicketDetailHeader, TicketDetailSkeleton } from "./ticket-detail-header";
import { formatTicketDate } from "./ticket-format";
import { getTicketErrorStatus } from "./ticket-error";
import { useTicket, useUpdateTicket } from "./ticket-hooks";
import { TicketSidebar } from "./ticket-sidebar";
import { TicketWorkspaceTabs, type TicketWorkspaceHandle } from "./ticket-workspace-tabs";
import { TicketPage, TicketState } from "./ticket-ui";
import { canCloseTicket, canManageTicketDefinition, canOperateAssignedTicket } from "./ticket-permissions";

export function TicketDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = "" } = useParams();
  const { user } = useAuth();
  const ticket = useTicket(id);
  const attachments = useTicketAttachments(id);
  const uploadAttachment = useUploadTicketAttachment(id);

  const [aiOpen, setAiOpen] = useState(false);
  const [attachMode, setAttachMode] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [sendToken, setSendToken] = useState(0);
  const aiButtonRef = useRef<HTMLButtonElement>(null);
  const workspaceRef = useRef<TicketWorkspaceHandle>(null);

  // Stable bridge from the AI panel to the public reply composer. It only proxies
  // to the imperative handle — no DOM access, no shared store.
  const replyInsertion = useMemo<ReplyInsertionApi>(
    () => ({
      hasReplyText: () => workspaceRef.current?.hasReplyText() ?? false,
      insertSuggestedReply: (text, mode) =>
        workspaceRef.current?.insertSuggestedReply(text, mode) ?? "unavailable",
    }),
    [],
  );

  // AI "Apply Category" reuses the normal ticket-update mutation (RBAC + cache
  // refresh handled there); the AI endpoint never mutates the ticket.
  const ticketUpdate = useUpdateTicket(id);
  const categoryApply: CategoryApplyApi = {
    apply: (categoryId) => ticketUpdate.mutateAsync({ categoryId }),
  };

  if (ticket.isLoading) return <TicketPage><TicketDetailSkeleton label={t("common.loading")} /></TicketPage>;
  if (ticket.isError || !ticket.data) {
    const statusCode = getTicketErrorStatus(ticket.error);
    return (
      <TicketPage>
        <TicketState>
          {statusCode === 404
            ? t("tickets.notFound")
            : statusCode === 403
              ? t("tickets.unauthorized")
              : t("tickets.loadDetailError")}{" "}
          {statusCode !== 404 && statusCode !== 403 && (
            <button className="button-secondary mt-4" onClick={() => ticket.refetch()}>
              {t("common.retry")}
            </button>
          )}
        </TicketState>
      </TicketPage>
    );
  }

  const record = ticket.data;
  const canManage = Boolean(user && canManageTicketDefinition(user.role));
  const canWorkflow = Boolean(user && canOperateAssignedTicket(record, user));
  const canClose = Boolean(user && canCloseTicket(record, user));

  const ticketLevelAttachments = attachments.data?.filter((item) => item.messageId === null) ?? [];
  const messageAttachments = new Map<string, typeof ticketLevelAttachments>();
  for (const item of attachments.data ?? [])
    if (item.messageId)
      messageAttachments.set(item.messageId, [...(messageAttachments.get(item.messageId) ?? []), item]);

  const upload = canWorkflow
    ? { mutateAsync: (file: File) => uploadAttachment.mutateAsync(file), isPending: uploadAttachment.isPending }
    : undefined;

  return (
    <TicketPage>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Main ticket area — header + summary live here so the right rail (grid
            col 2) starts level with the header, not with the Conversation card. */}
        <div className="flex min-w-0 flex-col gap-4 lg:h-[calc(100dvh-2rem)] lg:overflow-hidden">
          <TicketDetailHeader
            backTo="/tickets"
            backLabel={t("tickets.backToList")}
            reference={record.id}
            subject={record.subject}
            badges={
              <>
                <TicketStatusBadge status={record.status} />
                <TicketPriorityText priority={record.priority} />
                <span className="text-xs text-muted-foreground">{t(`tickets.channel.${record.channel}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {t("tickets.created")} <bdi dir="ltr">{formatTicketDate(record.createdAt, i18n.language)}</bdi>
                </span>
              </>
            }
            actions={
              <div className="flex items-center gap-2">
                <button
                  ref={aiButtonRef}
                  type="button"
                  className="button-secondary inline-flex items-center gap-1.5 sm:w-auto"
                  onClick={() => setAiOpen(true)}
                >
                  <Sparkles className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {t("aiAssistant.title")}
                </button>
                {canManage && (
                  <Link className="button-secondary sm:w-auto" to={`/tickets/${record.id}/edit`}>
                    {t("common.edit")}
                  </Link>
                )}
              </div>
            }
          />
          <TicketContextSummary record={record} />
          <div className="min-w-0 lg:min-h-0 lg:flex-1">
            <TicketConversation
              items={record.conversation}
              messageAttachments={messageAttachments}
              autoScrollSendToken={sendToken}
              attachMode={attachMode}
              upload={upload}
              pendingAttachment={pendingAttachment}
              onExitAttachMode={() => {
                setAttachMode(false);
                setPendingAttachment(null);
              }}
            />
          </div>
          <TicketWorkspaceTabs
            ref={workspaceRef}
            className="lg:shrink-0"
            ticketId={record.id}
            canMutate={canWorkflow}
            channel={record.channel}
            customerPhone={record.customer.phone}
            attachments={ticketLevelAttachments}
            attachmentsLoading={attachments.isLoading}
            attachmentsError={attachments.isError}
            onRetryAttachments={() => attachments.refetch()}
            history={record.history}
            description={record.description}
            locale={i18n.language}
            onSent={() => setSendToken((token) => token + 1)}
            onAttachFile={(file) => {
              setPendingAttachment(file);
              setAttachMode(true);
            }}
            attachMode={attachMode}
          />
        </div>
        <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
          <TicketSidebar
            record={record}
            canManage={canManage}
            canWorkflow={canWorkflow}
            canClose={canClose}
            locale={i18n.language}
          />
        </div>
      </div>

      <AiAssistantPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        returnFocusRef={aiButtonRef}
        ticketId={record.id}
        replyInsertion={canWorkflow ? replyInsertion : undefined}
        currentCategoryId={record.category?.id ?? null}
        categoryApply={canManage ? categoryApply : undefined}
      />
    </TicketPage>
  );
}
