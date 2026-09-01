import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    select: {
      name: true,
      manager: { select: { email: true } },
      department: { select: { name: true } },
      _count: { select: { members: true, tickets: true } },
    },
    orderBy: { name: "asc" },
  });
  for (const t of teams) {
    console.log(
      `${t.name.padEnd(20)} dept=${(t.department.name).padEnd(20)} mgr=${(t.manager?.email ?? "-").padEnd(22)} agents=${t._count.members} tickets=${t._count.tickets}`,
    );
  }
  const nullTeam = await prisma.ticket.count({ where: { teamId: null } });
  const assignedRows = await prisma.ticket.findMany({
    where: { assignedAgentId: { not: null } },
    select: { teamId: true, assignedAgent: { select: { teamId: true } } },
  });
  const mismatch = assignedRows.filter((r) => r.teamId !== r.assignedAgent?.teamId).length;
  const managers = await prisma.user.count({ where: { role: "MANAGER" } });
  const managersWithTeam = await prisma.user.count({ where: { role: "MANAGER", teamId: { not: null } } });
  const agents = await prisma.user.count({ where: { role: "AGENT" } });
  const agentsWithTeam = await prisma.user.count({ where: { role: "AGENT", teamId: { not: null } } });
  console.log(`\nunrouted tickets (teamId=null): ${nullTeam}`);
  console.log(`assigned tickets w/ team != agent.team: ${mismatch} / ${assignedRows.length}`);
  console.log(`managers with team: ${managersWithTeam}/${managers} | agents with team: ${agentsWithTeam}/${agents}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
