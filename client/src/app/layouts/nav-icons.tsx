import type { LucideProps } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  MessageSquareQuote,
  Ticket,
  UserCog,
  Users,
  Settings,
} from "lucide-react";

export function DashboardNavIcon(props: LucideProps) {
  return <LayoutDashboard size={18} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function TicketsNavIcon(props: LucideProps) {
  return <Ticket size={18} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function CustomersNavIcon(props: LucideProps) {
  return <Users size={18} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function KnowledgeBaseNavIcon(props: LucideProps) {
  return <BookOpen size={18} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ReportsNavIcon(props: LucideProps) {
  return <BarChart3 size={18} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function QuickRepliesNavIcon(props: LucideProps) {
  return <MessageSquareQuote size={18} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function TasksNavIcon(props: LucideProps) {
  return <CheckSquare size={18} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function UsersNavIcon(props: LucideProps) {
  return <UserCog size={18} strokeWidth={1.75} aria-hidden="true" {...props} />;
}
export function SettingsNavIcon(props: LucideProps) { return <Settings size={18} strokeWidth={1.75} aria-hidden="true" {...props} />; }

export function LogoutIcon(props: LucideProps) {
  return <LogOut size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function CollapseIcon(props: LucideProps) {
  return <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ExpandIcon(props: LucideProps) {
  return <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ChevronDownNavIcon(props: LucideProps) {
  return <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ChevronRightNavIcon(props: LucideProps) {
  return <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" {...props} />;
}
