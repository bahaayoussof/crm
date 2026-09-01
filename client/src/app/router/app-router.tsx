import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { ForgotPasswordPage } from "@/features/auth/forgot-password-page";
import { ResetPasswordPage } from "@/features/auth/reset-password-page";
import { CustomerDetailPage } from "@/features/customers/customer-detail-page";
import { CustomerFormPage } from "@/features/customers/customer-form-page";
import { CustomerListPage } from "@/features/customers/customer-list-page";
import { TicketDetailPage } from "@/features/tickets/ticket-detail-page";
import { TicketFormPage } from "@/features/tickets/ticket-form-page";
import { TicketListPage } from "@/features/tickets/ticket-list-page";
import { ProtectedRoute } from "./protected-route";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { CustomerManageRoute } from "./customer-manage-route";
import { PortalHomePage, PortalNewTicketPage, PortalTicketDetailPage, PortalTicketsPage } from "@/features/portal/portal-pages";
import { PortalProfilePage } from "@/features/portal/profile/profile-page";
import { PortalKnowledgeArticlePage, PortalKnowledgeBasePage } from "@/features/portal/portal-knowledge-pages";
import { KnowledgeArticleFormPage } from "@/features/knowledge-base/knowledge-article-form-page";
import { KnowledgeBaseDetailPage } from "@/features/knowledge-base/knowledge-base-detail-page";
import { KnowledgeBaseListPage } from "@/features/knowledge-base/knowledge-base-list-page";
import { KnowledgeArticleManageRoute } from "./knowledge-article-manage-route";
import { QuickReplyFormPage } from "@/features/quick-replies/quick-reply-form-page";
import { QuickReplyListPage } from "@/features/quick-replies/quick-reply-list-page";
import { QuickReplyManageRoute } from "./quick-reply-manage-route";
import {
  ReportsLayout,
  ReportsOverviewPage,
  ReportsSlaPage,
  ReportsAgentsPage,
  ReportsTicketsPage,
} from "@/features/reports/reports-page";
import { ReportsRoute } from "./reports-route";
import { UserFormPage } from "@/features/users/user-form-page";
import { UserListPage } from "@/features/users/user-list-page";
import { UserManageRoute } from "./user-manage-route";
import { TicketEditRoute } from "./ticket-edit-route";
import { SettingsPage } from "@/features/settings/settings-page";
import { SettingsRoute } from "./settings-route";
import { TaskDetailPage } from "@/features/tasks/task-detail-page";
import { TaskFormPage } from "@/features/tasks/task-form-page";
import { TaskListPage } from "@/features/tasks/task-list-page";
import { AuditLogPage } from "@/features/audit-logs/audit-log-page";
import { AuditLogRoute } from "./audit-log-route";
import { InternalProfilePage } from "@/features/profile/internal-profile-page";
import { RealtimeProvider } from "@/features/realtime/realtime-provider";
import { ManagerRoute } from "./manager-route";
import { ManagerOverviewPage } from "@/features/manager/manager-overview-page";
import { ManagerTeamPage } from "@/features/manager/manager-team-page";
import { ManagerAgentDetailPage } from "@/features/manager/manager-agent-detail-page";
import { useAuth } from "@/features/auth/auth-state";
import { isManagerHomeRole } from "@/features/manager/manager-permissions";

/** MANAGER's home is the Work Console; everyone else keeps the shared dashboard. */
function DashboardEntry() {
  const { user } = useAuth();
  if (user && isManagerHomeRole(user.role)) return <Navigate to="/manager" replace />;
  return <DashboardPage />;
}

export function AppRouter() {
  return <BrowserRouter><RealtimeProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute audience="internal" />}>
      <Route path="/dashboard" element={<DashboardEntry />} />
      <Route element={<ManagerRoute />}>
        <Route path="/manager" element={<ManagerOverviewPage />} />
        <Route path="/manager/team" element={<ManagerTeamPage />} />
        <Route path="/manager/team/:agentId" element={<ManagerAgentDetailPage />} />
      </Route>
      <Route path="/tickets" element={<TicketListPage />} />
      <Route path="/tickets/new" element={<TicketFormPage />} />
      <Route element={<TicketEditRoute />}><Route path="/tickets/:id/edit" element={<TicketFormPage />} /></Route>
      <Route path="/tickets/:id" element={<TicketDetailPage />} />
      <Route path="/customers" element={<CustomerListPage />} />
      <Route element={<CustomerManageRoute />}>
        <Route path="/customers/new" element={<CustomerFormPage />} />
        <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
      </Route>
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
      <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />
      <Route element={<KnowledgeArticleManageRoute />}>
        <Route path="/knowledge-base/new" element={<KnowledgeArticleFormPage />} />
        <Route path="/knowledge-base/:id/edit" element={<KnowledgeArticleFormPage />} />
      </Route>
      <Route path="/knowledge-base/:id" element={<KnowledgeBaseDetailPage />} />
      <Route path="/tasks" element={<TaskListPage />} />
      <Route path="/tasks/new" element={<TaskFormPage />} />
      <Route path="/tasks/:id" element={<TaskDetailPage />} />
      <Route path="/tasks/:id/edit" element={<TaskFormPage />} />
      <Route element={<QuickReplyManageRoute />}>
        <Route path="/quick-replies" element={<QuickReplyListPage />} />
        <Route path="/quick-replies/new" element={<QuickReplyFormPage />} />
        <Route path="/quick-replies/:id/edit" element={<QuickReplyFormPage />} />
      </Route>
      <Route element={<ReportsRoute />}>
        <Route element={<ReportsLayout />}>
          <Route path="/reports" element={<ReportsOverviewPage />} />
          <Route path="/reports/sla" element={<ReportsSlaPage />} />
          <Route path="/reports/agents" element={<ReportsAgentsPage />} />
          <Route path="/reports/tickets" element={<ReportsTicketsPage />} />
        </Route>
      </Route>

      <Route element={<UserManageRoute />}>
        <Route path="/users" element={<UserListPage />} />
        <Route path="/users/new" element={<UserFormPage />} />
        <Route path="/users/:id/edit" element={<UserFormPage />} />
      </Route>
      <Route element={<SettingsRoute />}><Route path="/settings" element={<SettingsPage />} /></Route>
      <Route element={<AuditLogRoute />}><Route path="/audit-logs" element={<AuditLogPage />} /></Route>
      <Route path="/profile" element={<InternalProfilePage />} />
    </Route>
    <Route element={<ProtectedRoute audience="customer" />}>
      <Route path="/portal" element={<PortalHomePage />} />
      <Route path="/portal/tickets" element={<PortalTicketsPage />} />
      <Route path="/portal/tickets/new" element={<PortalNewTicketPage />} />
      <Route path="/portal/tickets/:id" element={<PortalTicketDetailPage />} />
      <Route path="/portal/profile" element={<PortalProfilePage />} />
      <Route path="/portal/knowledge-base" element={<PortalKnowledgeBasePage />} />
      <Route path="/portal/knowledge-base/:id" element={<PortalKnowledgeArticlePage />} />
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></RealtimeProvider></BrowserRouter>;
}
