import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/login-page";
import { ProtectedPlaceholderPage } from "@/features/auth/protected-placeholder-page";
import { RegisterPage } from "@/features/auth/register-page";
import { ProtectedRoute } from "./protected-route";

export function AppRouter() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route element={<ProtectedRoute audience="internal" />}><Route path="/dashboard" element={<ProtectedPlaceholderPage area="dashboard" />} /></Route><Route element={<ProtectedRoute audience="customer" />}><Route path="/portal" element={<ProtectedPlaceholderPage area="portal" />} /></Route><Route path="*" element={<Navigate to="/login" replace />} /></Routes></BrowserRouter>;
}
