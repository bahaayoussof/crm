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

    it("shows a button for every role", async () => {
      await renderPanel();
      expect(screen.getByText("Try the demo")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue as Admin" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue as Manager" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue as Agent" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue as Customer" })).toBeInTheDocument();
    });

    it("signs in through the real login flow with the published demo credentials", async () => {
      mocks.login.mockResolvedValue({ role: "ADMIN" });
      await renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Continue as Admin" }));
      await waitFor(() =>
        expect(mocks.login).toHaveBeenCalledWith({ email: "admin@demo.local", password: "Demo123!" }),
      );
      expect(mocks.navigate).toHaveBeenCalled();
    });
  });
});
