import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ resetPasswordRequest: vi.fn() }));
vi.mock("./auth-api", () => ({ resetPasswordRequest: mocks.resetPasswordRequest }));

import { ResetPasswordPage } from "./reset-password-page";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );

const axiosError = (code: string) => ({ isAxiosError: true, response: { data: { error: { code } } } });

describe("ResetPasswordPage", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.resetPasswordRequest.mockResolvedValue({ ok: true });
  });

  it("shows the invalid-link panel when no token is present", () => {
    renderAt("/reset-password");
    expect(screen.getByText("This password reset link is invalid or has expired.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("validates password length and match", async () => {
    renderAt("/reset-password?token=abc");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(mocks.resetPasswordRequest).not.toHaveBeenCalled();
  });

  it("shows the success panel after a successful reset", async () => {
    renderAt("/reset-password?token=abc");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpassword1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "newpassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() =>
      expect(
        screen.getByText("Password updated successfully. You can now sign in using your new password."),
      ).toBeInTheDocument(),
    );
    expect(mocks.resetPasswordRequest).toHaveBeenCalledWith({
      token: "abc",
      password: "newpassword1",
      confirmPassword: "newpassword1",
    });
  });

  it("shows the invalid-link panel when the token is rejected", async () => {
    mocks.resetPasswordRequest.mockRejectedValue(axiosError("TOKEN_EXPIRED"));
    renderAt("/reset-password?token=stale");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpassword1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "newpassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() =>
      expect(screen.getByText("This password reset link is invalid or has expired.")).toBeInTheDocument(),
    );
  });
});
