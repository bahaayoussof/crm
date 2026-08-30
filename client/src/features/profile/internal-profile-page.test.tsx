import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ getSelfProfile: vi.fn(), updateSelfProfile: vi.fn() }));
vi.mock("./profile.api", () => mocks);

import { InternalProfilePage } from "./internal-profile-page";

const makeProfile = (role: "ADMIN" | "MANAGER" | "AGENT" = "ADMIN") => ({
  name: "Mona Hassan",
  email: "mona@example.com",
  phone: "+201234567890",
  role,
  createdAt: "2025-01-15T00:00:00.000Z",
  passwordChangedAt: null,
});

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
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
  });

  describe("ADMIN role", () => {
    beforeEach(() => {
      mocks.getSelfProfile.mockResolvedValue(makeProfile("ADMIN"));
      mocks.updateSelfProfile.mockResolvedValue(makeProfile("ADMIN"));
    });

    it("renders the shared account profile with Edit button and Change Password", async () => {
      renderPage();
      expect((await screen.findAllByText("Mona Hassan")).length).toBeGreaterThan(0);
      expect(screen.getByText("Admin")).toBeInTheDocument();
      expect(screen.getByText("Personal Information")).toBeInTheDocument();
      expect(screen.getByText("Not changed yet")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Change Password" })).toBeInTheDocument();
    });

    it("opens the Edit Profile dialog containing name, email, and phone inputs", async () => {
      renderPage();
      await screen.findAllByText("Mona Hassan");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("heading", { name: "Edit profile" })).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Full name")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Email address")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Phone number")).toBeInTheDocument();
    });

    it("opens the Change Password dialog", async () => {
      renderPage();
      await screen.findAllByText("Mona Hassan");
      fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("heading", { name: "Change password" })).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Current password")).toBeInTheDocument();
    });
  });

  describe("MANAGER role", () => {
    beforeEach(() => {
      mocks.getSelfProfile.mockResolvedValue(makeProfile("MANAGER"));
      mocks.updateSelfProfile.mockResolvedValue(makeProfile("MANAGER"));
    });

    it("presents personal information and opens Edit Profile dialog with read-only name and email and editable phone", async () => {
      renderPage();
      expect((await screen.findAllByText("Mona Hassan")).length).toBeGreaterThan(0);
      expect(screen.getByText("Manager")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Change Password" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("heading", { name: "Edit profile" })).toBeInTheDocument();

      const nameInput = within(dialog).getByLabelText("Full name");
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveValue("Mona Hassan");
      expect(nameInput).toHaveAttribute("readonly");

      const emailInput = within(dialog).getByLabelText("Email address");
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveValue("mona@example.com");
      expect(emailInput).toHaveAttribute("readonly");

      const phoneInput = within(dialog).getByLabelText("Phone number");
      expect(phoneInput).toBeEnabled();

      fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
      await waitFor(() => {
        expect(mocks.updateSelfProfile).toHaveBeenCalledWith({ phone: "+201234567890" }, expect.anything());
      });
    });

    it("opens the Change Password dialog for MANAGER", async () => {
      renderPage();
      await screen.findAllByText("Mona Hassan");
      fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("heading", { name: "Change password" })).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Current password")).toBeInTheDocument();
    });
  });

  describe("AGENT role", () => {
    beforeEach(() => {
      mocks.getSelfProfile.mockResolvedValue(makeProfile("AGENT"));
      mocks.updateSelfProfile.mockResolvedValue(makeProfile("AGENT"));
    });

    it("presents personal information and opens Edit Profile dialog with read-only name and email and editable phone", async () => {
      renderPage();
      expect((await screen.findAllByText("Mona Hassan")).length).toBeGreaterThan(0);
      expect(screen.getByText("Agent")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Change Password" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("heading", { name: "Edit profile" })).toBeInTheDocument();

      const nameInput = within(dialog).getByLabelText("Full name");
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveValue("Mona Hassan");
      expect(nameInput).toHaveAttribute("readonly");

      const emailInput = within(dialog).getByLabelText("Email address");
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveValue("mona@example.com");
      expect(emailInput).toHaveAttribute("readonly");

      const phoneInput = within(dialog).getByLabelText("Phone number");
      expect(phoneInput).toBeEnabled();
      expect(within(dialog).queryByLabelText("Role")).not.toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
      await waitFor(() => {
        expect(mocks.updateSelfProfile).toHaveBeenCalledWith({ phone: "+201234567890" }, expect.anything());
      });
    });

    it("shows validation error on invalid phone and blocks submission", async () => {
      renderPage();
      await screen.findAllByText("Mona Hassan");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));

      const dialog = screen.getByRole("dialog");
      const phoneInput = within(dialog).getByLabelText("Phone number");

      fireEvent.change(phoneInput, { target: { value: "+20 12" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

      expect(
        await within(dialog).findByText("Enter a valid phone number"),
      ).toBeInTheDocument();
      expect(mocks.updateSelfProfile).not.toHaveBeenCalled();
    });

    it("opens the Change Password dialog for AGENT", async () => {
      renderPage();
      await screen.findAllByText("Mona Hassan");
      fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("heading", { name: "Change password" })).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Current password")).toBeInTheDocument();
    });
  });

  it("renders Arabic labels under RTL", async () => {
    mocks.getSelfProfile.mockResolvedValue(makeProfile("ADMIN"));
    await changeAppLanguage("ar");
    renderPage();
    expect(await screen.findByText("المعلومات الشخصية")).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
  });
});
