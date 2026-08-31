-- 1. Safely migrate existing records with status 'NEW' to 'OPEN'
UPDATE "Ticket" SET "status" = 'OPEN' WHERE "status"::text = 'NEW';

-- 2. Create the new enum type without 'NEW'
CREATE TYPE "TicketStatus_new" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED', 'ESCALATED');

-- 3. Drop old default constraint on Ticket.status
ALTER TABLE "Ticket" ALTER COLUMN "status" DROP DEFAULT;

-- 4. Alter column type using explicit cast
ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus_new" USING ("status"::text::"TicketStatus_new");

-- 5. Set new default constraint on Ticket.status
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- 6. Drop old enum type and rename new type
DROP TYPE "TicketStatus";
ALTER TYPE "TicketStatus_new" RENAME TO "TicketStatus";
