import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({
    user: { id: "u-1", name: "Bahaa", email: "bahaa@example.com", role: "ADMIN", customer: null },
    isLoading: false,
    logout: vi.fn(),
  }),
}));
vi.mock("@/features/notifications/notification-bell", () => ({ NotificationBell: () => null }));

import { AppShell } from "./app-shell";

function renderShell(children: React.ReactNode = <div data-testid="page">content</div>) {
  return render(
    <MemoryRouter>
      <AppShell audience="internal">{children}</AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell layout", () => {
  beforeEach(async () => {
    await changeAppLanguage("en");
  });
  afterEach(cleanup);

  it("owns a single page-content scroll region, distinct from the sidebar", () => {
    const { container } = renderShell();
    const scroller = container.querySelector("[data-app-content-scroll]") as HTMLElement;
    expect(scroller).toBeTruthy();
    expect(scroller.className).toMatch(/overflow-y-auto/);
    expect(scroller.className).toMatch(/flex-1/);
    // the page renders inside that scroller
    expect(scroller).toContainElement(screen.getByTestId("page"));
    // the sidebar is not inside the page scroller
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside).toBeTruthy();
    expect(scroller.contains(aside)).toBe(false);
  });

  it("locks the shell to the viewport row so long content cannot grow the sidebar", () => {
    const { container } = renderShell();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/h-full/);
    expect(root.className).toMatch(/overflow-hidden/);
    expect(root.className).toMatch(/lg:grid-rows-1/);
  });
});
