-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "stagedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Attachment_stagedByUserId_idx" ON "Attachment"("stagedByUserId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_stagedByUserId_fkey" FOREIGN KEY ("stagedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
