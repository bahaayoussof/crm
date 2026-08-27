-- Add optional ticketId relation to Notification for targeted navigation
ALTER TABLE "Notification" ADD COLUMN "ticketId" TEXT;

-- Add foreign key constraint (Restrict: deleting a Ticket leaves a historic notification record
-- but we set null on delete for notifications since the ticket may be gone)
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for efficient per-ticket notification lookups
CREATE INDEX "Notification_ticketId_idx" ON "Notification"("ticketId");
