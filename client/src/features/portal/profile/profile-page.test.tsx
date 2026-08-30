import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  getPortalProfile: vi.fn(),
  updatePortalProfile: vi.fn(),
  setAuthToken: vi.fn(),
  changePasswordRequest: vi.fn(),
}));
vi.mock("./profile.api", () => ({
  getPortalProfile: mocks.getPortalProfile,
  updatePortalProfile: mocks.updatePortalProfile,
}));
vi.mock("@/features/auth/auth-token", () => ({ setAuthToken: mocks.setAuthToken }));
vi.mock("@/features/auth/auth-api", () => ({ changePasswordRequest: mocks.changePasswordRequest }));

import { PortalProfilePage } from "./profile-page";

const profile = { name: "Bahaa Youssof", email: "bahaa@example.com", phone: "+20100000000" };

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PortalProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("PortalProfilePage", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.getPortalProfile.mockResolvedValue(profile);
    mocks.updatePortalProfile.mockResolvedValue(profile);
  });

  it("shows the customer's name, email and phone", async () => {
    renderPage();
    expect(await screen.findByText("Bahaa Youssof")).toBeInTheDocument();
    expect(screen.getByText("bahaa@example.com")).toBeInTheDocument();
    expect(screen.getByText("+20100000000")).toBeInTheDocument();
  });

  it("opens the Edit Profile dialog and refreshes the displayed value after saving", async () => {
    mocks.updatePortalProfile.mockResolvedValue({ ...profile, name: "Bahaa Y" });
    renderPage();
    await screen.findByText("Bahaa Youssof");
    // Server state after the update (the post-save refetch reads this).
    mocks.getPortalProfile.mockResolvedValue({ ...profile, name: "Bahaa Y" });
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Full name"), { target: { value: "Bahaa Y" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Bahaa Y")).toBeInTheDocument();
  });

  it("shows a duplicate-email error on the email field", async () => {
    mocks.updatePortalProfile.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { code: "EMAIL_IN_USE" } } },
    });
    renderPage();
    await screen.findByText("Bahaa Youssof");
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "taken@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await within(dialog).findByText("This email is already in use.")).toBeInTheDocument();
  });

  it("opens the Change Password dialog", async () => {
    renderPage();
    await screen.findByText("Bahaa Youssof");
    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
  });
});
