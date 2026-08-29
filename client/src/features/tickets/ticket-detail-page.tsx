import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { useTicketAttachments, useUploadTicketAttachment } from "@/features/attachments/attachment-hooks";
import type { CategoryApplyApi, ReplyInsertionApi } from "@/features/ai-assistant/ai-assistant.types";
import { TicketAttachments } from "./ticket-attachments";
import { TicketPriorityText, TicketStatusBadge } from "./ticket-badges";
import { TicketConversation, type TicketConversationHandle } from "./ticket-conversation";
import { TicketDetailHeader, TicketDetailSkeleton } from "./ticket-detail-header";
import { getTicketErrorStatus } from "./ticket-error";
import { useTicket, useUpdateTicket } from "./ticket-hooks";
import { TicketSidebar } from "./ticket-sidebar";
import { TicketPage, TicketState } from "./ticket-ui";
import { canCloseTicket, canManageTicketDefinition, canOperateAssignedTicket } from "./ticket-permissions";

export function TicketDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = "" } = useParams();
  const { user } = useAuth();
  const ticket = useTicket(id);
  const attachments = useTicketAttachments(id);
  const uploadAttachment = useUploadTicketAttachment(id);

  const conversationRef = useRef<TicketConversationHandle>(null);
  // Stable bridge from the sidebar AI panel to the public reply composer. It only
  // proxies to the imperative handle — no DOM access, no shared store.
  const replyInsertion = useMemo<ReplyInsertionApi>(
    () => ({
      hasReplyText: () => conversationRef.current?.hasReplyText() ?? false,
      insertSuggestedReply: (text, mode) =>
        conversationRef.current?.insertSuggestedReply(text, mode) ?? "unavailable",
    }),
    [],
  );

  // AI "Apply Category" reuses the normal ticket-update mutation (RBAC + cache
  // refresh handled there); the AI endpoint never mutates the ticket. The
  // adapter is rebuilt each render (cheap, and never used as an effect dep).
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

  return (
    <TicketPage>
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
          </>
        }
        actions={
          canManage && (
            <Link className="button-secondary" to={`/tickets/${record.id}/edit`}>
              {t("common.edit")}
            </Link>
          )
        }
      />
      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-4 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
          <div className="min-w-0 lg:min-h-0 lg:flex-1">
            <TicketConversation
              ref={conversationRef}
              ticketId={record.id}
              items={record.conversation}
              canMutate={canWorkflow}
              messageAttachments={messageAttachments}
              canUpload={canWorkflow}
              channel={record.channel}
              customerPhone={record.customer.phone}
              upload={{
                mutateAsync: (file) => uploadAttachment.mutateAsync(file),
                isPending: uploadAttachment.isPending,
              }}
            />
          </div>
          <TicketAttachments
            attachments={ticketLevelAttachments}
            isLoading={attachments.isLoading}
            isError={attachments.isError}
            onRetry={() => attachments.refetch()}
            locale={i18n.language}
            className="lg:shrink-0"
          />
        </div>
        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <TicketSidebar
            record={record}
            canManage={canManage}
            canWorkflow={canWorkflow}
            canClose={canClose}
            locale={i18n.language}
            replyInsertion={canWorkflow ? replyInsertion : undefined}
            categoryApply={canManage ? categoryApply : undefined}
          />
        </div>
      </div>
    </TicketPage>
  );
}
