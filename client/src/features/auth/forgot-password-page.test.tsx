import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ forgotPasswordRequest: vi.fn() }));
vi.mock("./auth-api", () => ({ forgotPasswordRequest: mocks.forgotPasswordRequest }));

import { ForgotPasswordPage } from "./forgot-password-page";

const renderPage = () => render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

describe("ForgotPasswordPage", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.forgotPasswordRequest.mockResolvedValue({ message: "ok" });
  });

  it("renders the email form", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Forgot your password?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("validates the email field", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(mocks.forgotPasswordRequest).not.toHaveBeenCalled();
  });

  it("shows the generic success panel after submitting", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() =>
      expect(
        screen.getByText("If an account exists for this email, a password reset link has been sent."),
      ).toBeInTheDocument(),
    );
    expect(mocks.forgotPasswordRequest).toHaveBeenCalledWith({ email: "user@example.com" });
  });
});
