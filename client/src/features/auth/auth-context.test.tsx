import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth-context";
import { useAuth } from "./auth-state";
import { getAuthToken, setAuthToken } from "./auth-token";
import { LoginPage } from "./login-page";
import { ProtectedPlaceholderPage } from "./protected-placeholder-page";
import { changeAppLanguage } from "@/lib/i18n";
import { ProtectedRoute } from "@/app/router/protected-route";

const authenticatedUser = {
  id: "admin-1",
  name: "Test Admin",
  email: "admin@example.com",
  role: "ADMIN" as const,
  customer: null,
};

vi.mock("./auth-api", () => ({
  getCurrentUserRequest: vi.fn(async () => authenticatedUser),
  loginRequest: vi.fn(),
  registerRequest: vi.fn(),
}));

function AuthStateHarness() {
  const { user, logout } = useAuth();
  return user
    ? <button onClick={logout}>{user.email}</button>
    : <p>Signed out</p>;
}

describe("AuthProvider logout", () => {
  afterEach(cleanup);

  beforeEach(async () => {
    window.localStorage.clear();
    await changeAppLanguage("en");
  });

  it("clears the token and authenticated user immediately", async () => {
    setAuthToken("test-token");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider><AuthStateHarness /></AuthProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: authenticatedUser.email }));

    await waitFor(() => expect(screen.getByText("Signed out")).toBeInTheDocument());
    expect(getAuthToken()).toBeNull();
  });

  it("keeps the user on the login page after clicking logout", async () => {
    setAuthToken("test-token");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route element={<ProtectedRoute audience="internal" />}><Route path="/dashboard" element={<ProtectedPlaceholderPage area="dashboard" />} /></Route>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    const profileTriggers = await screen.findAllByRole("button", { name: /Test Admin/i });
    fireEvent.click(profileTriggers[0]);
    const logoutBtn = await screen.findByRole("menuitem", { name: "Log out" });
    fireEvent.click(logoutBtn);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(getAuthToken()).toBeNull();
  });

  it("renders the login form in Arabic when Arabic is active", async () => {
    await changeAppLanguage("ar");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes><Route path="/login" element={<LoginPage />} /></Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "تسجيل الدخول" })).toBeInTheDocument();
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeInTheDocument();
    expect(screen.getByLabelText("كلمة المرور")).toBeInTheDocument();
  });
});
