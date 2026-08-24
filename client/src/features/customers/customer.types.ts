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

export interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
  attachments: Array<{ id: string; fileName: string; mimeType: string; storageKey: string; createdAt: string }>;
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

export interface CustomerFilters { search: string; page: number; limit: number }
