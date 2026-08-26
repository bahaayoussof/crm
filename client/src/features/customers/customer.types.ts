export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  openTicketCount: number;
  totalTicketCount: number;
  lastInteractionAt: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends CustomerRecord {
  user: { id: string; name: string; email: string; role: string } | null;
  attachments: Array<{ id: string; fileName: string; mimeType: string; createdAt: string }>;
  supportSummary: { openTicketCount: number; totalTicketCount: number; lastInteractionAt: string };
}

export interface CustomerNote {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
}

export interface CustomerListResponse {
  data: CustomerListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CustomerTicketSummary {
  id: string;
  subject: string;
  status: import("@/features/tickets/ticket.types").TicketStatus;
  priority: import("@/features/tickets/ticket.types").TicketPriority;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
  assignedAgent: { id: string; name: string } | null;
  access: "FULL" | "SUMMARY_ONLY";
}

export interface CustomerTicketListResponse {
  data: CustomerTicketSummary[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CustomerFilters { search: string; page: number; limit: number }
