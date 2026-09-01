/** Dev-only: (re)create the manual-QA ADMIN bahaa@crm.com / 123 (bcrypt-hashed). */
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

if (process.env.NODE_ENV === "production") throw new Error("dev helper only");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123", 12);
  const user = await prisma.user.upsert({
    where: { email: "bahaa@crm.com" },
    update: { passwordHash, role: Role.ADMIN, isActive: true, name: "Bahaa" },
    create: { email: "bahaa@crm.com", passwordHash, role: Role.ADMIN, isActive: true, name: "Bahaa" },
    select: { id: true, email: true, role: true, isActive: true },
  });
  const verifies = await bcrypt.compare("123", (await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  })).passwordHash);
  console.log("bahaa:", JSON.stringify(user), "| password '123' verifies:", verifies);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
