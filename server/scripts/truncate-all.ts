/** Dev-only: wipe all data tables, keep schema + _prisma_migrations. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") throw new Error("refusing to truncate with NODE_ENV=production");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    "select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'",
  );
  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  console.log(`Truncated ${rows.length} tables: ${list}`);
}

main()
  .catch((e) => {
    console.error("truncate failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
