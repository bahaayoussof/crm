import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ login: vi.fn(), navigate: vi.fn() }));

vi.mock("./auth-state", () => ({ useAuth: () => ({ user: null, login: mocks.login }) }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

async function renderLogin() {
  vi.resetModules();
  const { i18nReady } = await import("@/lib/i18n");
  await i18nReady;
  const { LoginPage } = await import("./login-page");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Open the Radix select and click the option with the given accessible name. */
async function pickRole(name: string) {
  const trigger = screen.getByRole("combobox", { name: "Sign in as" });
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
  const option = await screen.findByRole("option", { name });
  fireEvent.click(option);
}

const emailField = () => screen.getByLabelText("Email") as HTMLInputElement;
const passwordField = () => screen.getByLabelText("Password") as HTMLInputElement;

describe("DemoRoleSelect on the login page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  beforeEach(() => vi.resetModules());

  it("does not render the selector unless VITE_DEMO_MODE is 'true'", async () => {
    await renderLogin();
    expect(screen.queryByRole("combobox", { name: "Sign in as" })).toBeNull();
  });

  describe("with VITE_DEMO_MODE=true", () => {
    beforeEach(() => vi.stubEnv("VITE_DEMO_MODE", "true"));

    it("renders the 'Sign in as' selector with the four demo roles", async () => {
      await renderLogin();
      const trigger = screen.getByRole("combobox", { name: "Sign in as" });
      fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
      await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
      for (const role of ["Admin", "Manager", "Agent", "Customer"]) {
        expect(screen.getByRole("option", { name: role })).toBeInTheDocument();
      }
    });

    it.each([
      ["Admin", "admin@demo.local"],
      ["Manager", "manager@demo.local"],
      ["Agent", "agent@demo.local"],
      ["Customer", "customer@demo.local"],
    ])("fills the email and password fields when %s is selected", async (role, email) => {
      await renderLogin();
      await pickRole(role);
      await waitFor(() => expect(emailField().value).toBe(email));
      expect(passwordField().value).toBe("Demo123!");
    });

    it("does not call the login flow or navigate when a role is selected", async () => {
      await renderLogin();
      await pickRole("Manager");
      await waitFor(() => expect(emailField().value).toBe("manager@demo.local"));
      expect(mocks.login).not.toHaveBeenCalled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it("keeps the fields editable after a role is selected", async () => {
      await renderLogin();
      await pickRole("Agent");
      await waitFor(() => expect(emailField().value).toBe("agent@demo.local"));
      fireEvent.change(emailField(), { target: { value: "someone@else.test" } });
      expect(emailField().value).toBe("someone@else.test");
    });

    it("submits the populated demo credentials through the real login flow on Sign in", async () => {
      mocks.login.mockResolvedValue({ role: "ADMIN" });
      await renderLogin();
      await pickRole("Admin");
      await waitFor(() => expect(emailField().value).toBe("admin@demo.local"));

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() =>
        expect(mocks.login).toHaveBeenCalledWith({ email: "admin@demo.local", password: "Demo123!" }),
      );
      expect(mocks.login).toHaveBeenCalledTimes(1);
    });
  });
});
