import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "./register-page";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  user: null,
}));

vi.mock("./auth-state", () => ({
  useAuth: () => ({
    user: mocks.user,
    register: mocks.register,
  }),
}));

function renderRegisterPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RegisterPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders register form with shared phone input", () => {
    renderRegisterPage();
    expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
  });

  it("submits register form with phone input", async () => {
    mocks.register.mockResolvedValue({ id: "1", role: "CUSTOMER" });
    renderRegisterPage();

    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: "+20 100 123 4567" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "Password123!" } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: "Password123!" } });

    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User",
          email: "test@example.com",
          phone: expect.stringMatching(/\+201001234567/),
        }),
      );
    });
  });
});
