export type PortalTicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_FOR_YOU" | "RESOLVED" | "CLOSED";
export interface PortalTicket { id: string; subject: string; status: PortalTicketStatus; category: { id: string; name: string } | null; createdAt: string; updatedAt: string }
export interface PortalMessage { id: string; body: string; createdAt: string; author: { id: string; name: string; kind: "CUSTOMER" | "SUPPORT" } }
export interface PortalTicketDetail extends PortalTicket { description: string; messages: PortalMessage[] }
export interface PortalOverview { counts: { open: number; waitingForYou: number; resolved: number }; recentTickets: PortalTicket[] }
export interface PortalCategory { id: string; name: string }
export interface PortalFilters { page: number; limit: number; search: string; status?: PortalTicketStatus }
export interface PortalTicketPage { data: PortalTicket[]; meta: { page: number; limit: number; total: number; totalPages: number } }

export interface PortalKnowledgeArticle { id: string; title: string; category: string | null; updatedAt: string; excerpt: string }
export interface PortalKnowledgeArticleDetail { id: string; title: string; content: string; category: string | null; updatedAt: string }
export interface PortalKnowledgeFilters { page: number; limit: number; search: string; category?: string }
export interface PortalKnowledgeArticlePage { data: PortalKnowledgeArticle[]; meta: { page: number; limit: number; total: number; totalPages: number } }
