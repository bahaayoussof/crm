import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/login-page";
import { ProtectedPlaceholderPage } from "@/features/auth/protected-placeholder-page";
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

export function AppRouter() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedRoute audience="internal" />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/tickets" element={<TicketListPage />} />
      <Route path="/tickets/new" element={<TicketFormPage />} />
      <Route path="/tickets/:id/edit" element={<TicketFormPage />} />
      <Route path="/tickets/:id" element={<TicketDetailPage />} />
      <Route path="/customers" element={<CustomerListPage />} />
      <Route element={<CustomerManageRoute />}>
        <Route path="/customers/new" element={<CustomerFormPage />} />
        <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
      </Route>
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
    </Route>
    <Route element={<ProtectedRoute audience="customer" />}><Route path="/portal" element={<ProtectedPlaceholderPage area="portal" />} /></Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></BrowserRouter>;
}
