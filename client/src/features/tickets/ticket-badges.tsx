import { useTranslation } from "react-i18next";
import type { TicketPriority, TicketStatus } from "./ticket.types";

const statusStyles: Record<TicketStatus, string> = {
  NEW: "border-gray-200 bg-gray-50 text-gray-700", OPEN: "border-blue-200 bg-blue-50 text-blue-700",
  IN_PROGRESS: "border-violet-200 bg-violet-50 text-violet-700", WAITING_CUSTOMER: "border-amber-200 bg-amber-50 text-amber-800",
  RESOLVED: "border-green-200 bg-green-50 text-green-700", CLOSED: "border-gray-300 bg-gray-100 text-gray-800", ESCALATED: "border-red-200 bg-red-50 text-red-700",
};
const priorityStyles: Record<TicketPriority, string> = {
  LOW: "text-gray-600", MEDIUM: "text-blue-700", HIGH: "text-amber-700", URGENT: "font-semibold text-red-700",
};
export function TicketStatusBadge({ status }: { status: TicketStatus }) { const { t } = useTranslation(); return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>{t(`tickets.status.${status}`)}</span>; }
export function TicketPriorityText({ priority }: { priority: TicketPriority }) { const { t } = useTranslation(); return <span className={`text-xs font-medium ${priorityStyles[priority]}`}>{t(`tickets.priority.${priority}`)}</span>; }
