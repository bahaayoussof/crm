import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ getSelfProfile: vi.fn(), updateSelfProfile: vi.fn() }));
vi.mock("./profile.api", () => mocks);

import { InternalProfilePage } from "./internal-profile-page";

const profile = {
  name: "Mona Hassan",
  email: "mona@example.com",
  phone: "+201234567890",
  role: "ADMIN" as const,
  createdAt: "2025-01-15T00:00:00.000Z",
  passwordChangedAt: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InternalProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("InternalProfilePage", () => {
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.getSelfProfile.mockResolvedValue(profile);
    mocks.updateSelfProfile.mockResolvedValue(profile);
  });

  it("renders the shared account profile for an internal user", async () => {
    renderPage();
    expect((await screen.findAllByText("Mona Hassan")).length).toBeGreaterThan(0);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Personal Information")).toBeInTheDocument();
    expect(screen.getByText("Not changed yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Password" })).toBeInTheDocument();
  });

  it("renders Arabic labels under RTL", async () => {
    await changeAppLanguage("ar");
    renderPage();
    expect(await screen.findByText("المعلومات الشخصية")).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
  });
});
