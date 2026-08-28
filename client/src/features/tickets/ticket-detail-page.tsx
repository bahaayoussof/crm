import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { useTicketAttachments, useUploadTicketAttachment } from "@/features/attachments/attachment-hooks";
import { TicketAttachments } from "./ticket-attachments";
import { TicketConversation } from "./ticket-conversation";
import { TicketDetailHeader } from "./ticket-detail-header";
import { getTicketErrorStatus } from "./ticket-error";
import { useTicket } from "./ticket-hooks";
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

  if (ticket.isLoading) return <TicketPage><TicketDetailSkeleton /></TicketPage>;
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
      <TicketDetailHeader record={record} canManage={canManage} />
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-4 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
          <div className="min-w-0 lg:min-h-0 lg:flex-1">
            <TicketConversation
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
          />
        </div>
      </div>
    </TicketPage>
  );
}

function TicketDetailSkeleton() {
  return (
    <div className="space-y-6" aria-label="loading">
      <div className="h-16 animate-pulse rounded-lg bg-muted/50" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
        <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
      </div>
    </div>
  );
}
