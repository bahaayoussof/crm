-- Enforce case-insensitive uniqueness of Customer.email at the database level.
-- Prisma schema cannot express a functional (expression) index, so this migration
-- is authored by hand rather than generated from schema.prisma. The existing
-- plain @unique on "email" (exact-case) is left in place unchanged; this index
-- is a stricter superset that also blocks case-variant duplicates
-- (e.g. "Ahmed@Example.com" vs "ahmed@example.com").
CREATE UNIQUE INDEX "Customer_email_lower_key" ON "Customer" ((LOWER(email)));
