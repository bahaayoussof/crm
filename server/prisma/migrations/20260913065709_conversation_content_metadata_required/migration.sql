-- AlterTable
ALTER TABLE "TicketMessage" ALTER COLUMN "contentFormat" SET NOT NULL,
ALTER COLUMN "contentSource" SET NOT NULL;

-- AlterTable
ALTER TABLE "TicketNote" ALTER COLUMN "contentFormat" SET NOT NULL,
ALTER COLUMN "contentSource" SET NOT NULL;

