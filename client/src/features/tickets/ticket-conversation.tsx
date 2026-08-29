import { useTranslation } from "react-i18next";
import { AttachmentWorkspace, MessageAttachmentList } from "@/features/attachments/attachment-ui";
import { ConversationMessage, ConversationSection } from "./ticket-conversation-ui";
import type { TicketConversationItem } from "./ticket.types";

type MessageAttachment = { id: string; fileName: string; mimeType: string; createdAt: string };

type TicketConversationProps = {
  items: TicketConversationItem[];
  messageAttachments?: Map<string, MessageAttachment[]>;
  /** Bump on every successful local send so the message viewport scrolls to latest. */
  autoScrollSendToken?: number;
  /** When true, the message viewport is swapped for the attachment-upload
   * workspace (the lower workspace tabs stay mounted and untouched). */
  attachMode?: boolean;
  /** Upload adapter for the attachment workspace. */
  upload?: { mutateAsync: (file: File) => Promise<unknown>; isPending: boolean };
  /** File already chosen via the composer's native OS picker — the workspace
   * opens straight to its preview/upload state. */
  pendingAttachment?: File | null;
  /** Leave attach mode (Cancel or a successful upload). */
  onExitAttachMode?: () => void;
};

/**
 * The conversation card: header + a bounded, internally-scrolling message region.
 * Chat-style alignment by sender role — customer messages start-aligned, staff
 * replies and internal notes end-aligned. The composer is NOT here; it lives in
 * the lower workspace tabs. Clicking "Attach file" there flips `attachMode`,
 * which swaps this card's message viewport for the upload workspace without
 * changing the card geometry or unmounting anything.
 */
export function TicketConversation({
  items,
  messageAttachments,
  autoScrollSendToken,
  attachMode = false,
  upload,
  pendingAttachment = null,
  onExitAttachMode,
}: TicketConversationProps) {
  const { t, i18n } = useTranslation();

  return (
    <ConversationSection
      bounded
      autoScrollItemCount={items.length}
      autoScrollSendToken={autoScrollSendToken}
      heading={t("tickets.conversation.title")}
      description={t("tickets.conversation.description")}
      timelineLabel={t("tickets.conversation.timelineLabel")}
      countLabel={items.length > 0 ? t("tickets.conversation.messageCount", { total: items.length }) : undefined}
      isEmpty={items.length === 0}
      emptyTitle={t("tickets.conversation.emptyTitle")}
      emptyDescription={t("tickets.conversation.emptyDescription")}
      viewportOverride={
        attachMode && upload ? (
          <AttachmentWorkspace
            upload={upload}
            initialFile={pendingAttachment}
            onDone={() => onExitAttachMode?.()}
            onCancel={() => onExitAttachMode?.()}
          />
        ) : undefined
      }
    >
      {items.map((item) => {
        const internal = item.kind === "INTERNAL_NOTE";
        const fromCustomer = item.author.role === "CUSTOMER";
        return (
          <ConversationMessage
            key={`${item.kind}-${item.id}`}
            side={fromCustomer ? "start" : "end"}
            maxWidthClass="sm:max-w-[62%]"
            tone={internal ? "internal" : "default"}
            title={item.author.name}
            meta={t(`tickets.conversation.roles.${item.author.role}`, { defaultValue: item.author.role })}
            badge={internal ? t("tickets.conversation.internalLabel") : undefined}
            footnote={internal ? undefined : t("tickets.conversation.publicLabel")}
            timestamp={item.createdAt}
            language={i18n.language}
            body={item.body}
            mentionize={internal}
            attachmentsSlot={
              internal ? undefined : (
                <MessageAttachmentList attachments={messageAttachments?.get(item.id) ?? []} scope="internal" />
              )
            }
          />
        );
      })}
    </ConversationSection>
  );
}
