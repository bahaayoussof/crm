import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
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
import { PortalKnowledgeArticlePage, PortalKnowledgeBasePage } from "@/features/portal/portal-knowledge-pages";
import { PortalShell } from "@/features/portal/portal-ui";
import { KnowledgeArticleFormPage } from "@/features/knowledge-base/knowledge-article-form-page";
import { KnowledgeBaseDetailPage } from "@/features/knowledge-base/knowledge-base-detail-page";
import { KnowledgeBaseListPage } from "@/features/knowledge-base/knowledge-base-list-page";
import { KnowledgeArticleManageRoute } from "./knowledge-article-manage-route";
import { QuickReplyFormPage } from "@/features/quick-replies/quick-reply-form-page";
import { QuickReplyListPage } from "@/features/quick-replies/quick-reply-list-page";
import { QuickReplyManageRoute } from "./quick-reply-manage-route";
import { ReportsPage } from "@/features/reports/reports-page";
import { ReportsRoute } from "./reports-route";
import { UserFormPage } from "@/features/users/user-form-page";
import { UserListPage } from "@/features/users/user-list-page";
import { UserManageRoute } from "./user-manage-route";
import { TicketEditRoute } from "./ticket-edit-route";

export function AppRouter() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedRoute audience="internal" />}>
      <Route path="/dashboard" element={<DashboardPage />} />
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
      <Route element={<QuickReplyManageRoute />}>
        <Route path="/quick-replies" element={<QuickReplyListPage />} />
        <Route path="/quick-replies/new" element={<QuickReplyFormPage />} />
        <Route path="/quick-replies/:id/edit" element={<QuickReplyFormPage />} />
      </Route>
      <Route element={<ReportsRoute />}>
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
      <Route element={<UserManageRoute />}>
        <Route path="/users" element={<UserListPage />} />
        <Route path="/users/new" element={<UserFormPage />} />
        <Route path="/users/:id/edit" element={<UserFormPage />} />
      </Route>
    </Route>
    <Route element={<ProtectedRoute audience="customer" />}><Route path="/portal" element={<PortalShell />}><Route index element={<PortalHomePage />} /><Route path="tickets" element={<PortalTicketsPage />} /><Route path="tickets/new" element={<PortalNewTicketPage />} /><Route path="tickets/:id" element={<PortalTicketDetailPage />} /><Route path="knowledge-base" element={<PortalKnowledgeBasePage />} /><Route path="knowledge-base/:id" element={<PortalKnowledgeArticlePage />} /></Route></Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></BrowserRouter>;
}
