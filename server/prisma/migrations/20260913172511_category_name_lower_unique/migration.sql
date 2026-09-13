-- Enforce case-insensitive uniqueness of Category.name at the database level.
-- Prisma schema cannot express a functional (expression) index, so this migration
-- is authored by hand rather than generated from schema.prisma. The existing
-- plain @unique on "name" (exact-case) is left in place unchanged; this index
-- is a stricter superset that also blocks case-variant duplicates
-- (e.g. "Billing" vs "billing"), matching the precedent set by
-- Customer_email_lower_key (migration 20260912163955_customer_email_lower_unique).
CREATE UNIQUE INDEX "Category_name_lower_key" ON "Category" ((LOWER(name)));
