import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ login: vi.fn(), navigate: vi.fn() }));

vi.mock("./auth-state", () => ({ useAuth: () => ({ login: mocks.login }) }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

async function renderPanel() {
  vi.resetModules();
  const { i18nReady } = await import("@/lib/i18n");
  await i18nReady;
  const { DemoLoginPanel } = await import("./demo-login-panel");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DemoLoginPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DemoLoginPanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  beforeEach(() => vi.resetModules());

  it("renders nothing unless VITE_DEMO_MODE is 'true'", async () => {
    const { container } = await renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  describe("with VITE_DEMO_MODE=true", () => {
    beforeEach(() => vi.stubEnv("VITE_DEMO_MODE", "true"));

    it("renders exactly one demo card with the header copy", async () => {
      await renderPanel();
      expect(screen.getAllByRole("region", { name: "Demo Accounts" })).toHaveLength(1);
      expect(screen.getByText("Demo Accounts")).toBeInTheDocument();
      expect(
        screen.getByText("Use any account below to explore the CRM by role."),
      ).toBeInTheDocument();
    });

    it("renders exactly four account rows with each role label", async () => {
      await renderPanel();
      expect(screen.getAllByRole("listitem")).toHaveLength(4);
      for (const role of ["Admin", "Manager", "Agent", "Customer"]) {
        expect(screen.getByText(role)).toBeInTheDocument();
      }
    });

    it("shows the four published demo emails and no non-demo credential", async () => {
      await renderPanel();
      for (const email of [
        "admin@demo.local",
        "manager@demo.local",
        "agent@demo.local",
        "customer@demo.local",
      ]) {
        expect(screen.getByText(email)).toBeInTheDocument();
      }
      expect(screen.queryByText(/bahaa/i)).toBeNull();
      expect(screen.queryByText(/@crm\.com/i)).toBeNull();
    });

    it("shows the shared password exactly once", async () => {
      await renderPanel();
      expect(screen.getByText("Password for all demo accounts")).toBeInTheDocument();
      expect(screen.getAllByText("Demo123!")).toHaveLength(1);
    });

    it("exposes a descriptive accessible name for every row action", async () => {
      await renderPanel();
      for (const role of ["Admin", "Manager", "Agent", "Customer"]) {
        expect(
          screen.getByRole("button", { name: `Use ${role} demo account` }),
        ).toBeInTheDocument();
      }
    });

    it.each([
      ["Admin", "admin@demo.local"],
      ["Manager", "manager@demo.local"],
      ["Agent", "agent@demo.local"],
      ["Customer", "customer@demo.local"],
    ])("signs %s in through the real login flow with the published credentials", async (role, email) => {
      mocks.login.mockResolvedValue({ role: role.toUpperCase() });
      await renderPanel();
      fireEvent.click(screen.getByRole("button", { name: `Use ${role} demo account` }));
      await waitFor(() =>
        expect(mocks.login).toHaveBeenCalledWith({ email, password: "Demo123!" }),
      );
      expect(mocks.login).toHaveBeenCalledTimes(1);
      expect(mocks.navigate).toHaveBeenCalled();
    });

    it("prevents duplicate submissions while a login is in flight", async () => {
      let resolveLogin: (value: { role: string }) => void = () => {};
      mocks.login.mockImplementation(
        () => new Promise<{ role: string }>((resolve) => { resolveLogin = resolve; }),
      );
      await renderPanel();

      const adminButton = screen.getByRole("button", { name: "Use Admin demo account" });
      fireEvent.click(adminButton);
      fireEvent.click(adminButton);
      fireEvent.click(screen.getByRole("button", { name: "Use Manager demo account" }));

      expect(mocks.login).toHaveBeenCalledTimes(1);
      expect(adminButton).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("button", { name: "Use Manager demo account" })).toBeDisabled();

      resolveLogin({ role: "ADMIN" });
      await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    });
  });
});
