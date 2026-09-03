import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function renderBanner() {
  vi.resetModules();
  const { i18nReady } = await import("@/lib/i18n");
  await i18nReady;
  const { DemoBanner } = await import("./demo-banner");
  return render(<DemoBanner />);
}

describe("DemoBanner", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
  beforeEach(() => vi.resetModules());

  it("renders nothing unless VITE_DEMO_MODE is 'true'", async () => {
    const { container } = await renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the demo notice and can be dismissed for the session", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    await renderBanner();
    expect(screen.getByText("Demo Environment")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("Demo Environment")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("crm_demo_banner_dismissed")).toBe("true");
  });
});
