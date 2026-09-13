-- CreateEnum
CREATE TYPE "ConversationContentFormat" AS ENUM ('PLAIN_TEXT', 'SANITIZED_HTML');

-- CreateEnum
CREATE TYPE "ConversationContentSource" AS ENUM ('STAFF', 'PORTAL', 'EMAIL', 'SMS', 'WHATSAPP', 'LIVE_CHAT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "noteId" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "liveChatSessionKey" TEXT;

-- AlterTable
ALTER TABLE "TicketMessage" ADD COLUMN     "contentFormat" "ConversationContentFormat",
ADD COLUMN     "contentSource" "ConversationContentSource",
ADD COLUMN     "inboundKey" TEXT;

-- AlterTable
ALTER TABLE "TicketNote" ADD COLUMN     "contentFormat" "ConversationContentFormat",
ADD COLUMN     "contentSource" "ConversationContentSource";

-- CreateTable
CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "claimedUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "firstAttemptedAt" TIMESTAMP(3),
    "lastAttemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageDelivery_messageId_key" ON "MessageDelivery"("messageId");

-- CreateIndex
CREATE INDEX "MessageDelivery_status_nextAttemptAt_idx" ON "MessageDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageDelivery_channel_providerMessageId_key" ON "MessageDelivery"("channel", "providerMessageId");

-- CreateIndex
CREATE INDEX "Attachment_noteId_idx" ON "Attachment"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_liveChatSessionKey_key" ON "Ticket"("liveChatSessionKey");

-- CreateIndex
CREATE UNIQUE INDEX "TicketMessage_inboundKey_key" ON "TicketMessage"("inboundKey");

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "TicketNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

