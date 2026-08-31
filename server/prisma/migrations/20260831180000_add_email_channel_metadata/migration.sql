-- Add provider-neutral metadata required for email threading and inbound
-- attachment idempotency. All columns are nullable to preserve existing data.
ALTER TABLE "Ticket" ADD COLUMN "emailThreadToken" TEXT;
ALTER TABLE "TicketMessage" ADD COLUMN "externalMessageId" TEXT;
ALTER TABLE "Attachment" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "Ticket_emailThreadToken_key" ON "Ticket"("emailThreadToken");
CREATE UNIQUE INDEX "TicketMessage_externalMessageId_key" ON "TicketMessage"("externalMessageId");
CREATE UNIQUE INDEX "Attachment_externalId_key" ON "Attachment"("externalId");
