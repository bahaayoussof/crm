import { Prisma, Role } from "@prisma/client";

export interface TicketActor { userId: string; role: Role }

export function ticketVisibilityWhere(actor: TicketActor): Prisma.TicketWhereInput {
  return actor.role === Role.AGENT ? { OR: [{ assignedAgentId: actor.userId }, { assignedAgentId: null }] } : {};
}
