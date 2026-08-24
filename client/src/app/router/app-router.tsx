import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/login-page";
import { ProtectedPlaceholderPage } from "@/features/auth/protected-placeholder-page";
import { RegisterPage } from "@/features/auth/register-page";
import { CustomerDetailPage } from "@/features/customers/customer-detail-page";
import { CustomerFormPage } from "@/features/customers/customer-form-page";
import { CustomerListPage } from "@/features/customers/customer-list-page";
import { ProtectedRoute } from "./protected-route";

export function AppRouter() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedRoute audience="internal" />}>
      <Route path="/dashboard" element={<ProtectedPlaceholderPage area="dashboard" />} />
      <Route path="/customers" element={<CustomerListPage />} />
      <Route path="/customers/new" element={<CustomerFormPage />} />
      <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
    </Route>
    <Route element={<ProtectedRoute audience="customer" />}><Route path="/portal" element={<ProtectedPlaceholderPage area="portal" />} /></Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></BrowserRouter>;
}
