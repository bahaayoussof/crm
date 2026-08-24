import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth-context";
import { useAuth } from "./auth-state";
import { getAuthToken, setAuthToken } from "./auth-token";
import { LoginPage } from "./login-page";
import { ProtectedPlaceholderPage } from "./protected-placeholder-page";
import "@/lib/i18n";

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
  beforeEach(() => window.localStorage.clear());

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
              <Route path="/dashboard" element={<ProtectedPlaceholderPage area="dashboard" />} />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(getAuthToken()).toBeNull();
  });
});
