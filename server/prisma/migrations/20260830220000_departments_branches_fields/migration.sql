-- Departments & Branches: additive organizational fields. Backwards compatible —
-- existing rows default to isActive = true; all new columns are nullable.

-- AlterTable
ALTER TABLE "Department" ADD COLUMN "description" TEXT;
ALTER TABLE "Department" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "code" TEXT;
ALTER TABLE "Branch" ADD COLUMN "address" TEXT;
ALTER TABLE "Branch" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_isActive_idx" ON "Branch"("isActive");

-- CreateIndex
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");

-- CreateIndex
CREATE INDEX "Department_branchId_idx" ON "Department"("branchId");
