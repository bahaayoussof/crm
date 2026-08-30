import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ changePasswordRequest: vi.fn(), setAuthToken: vi.fn() }));
vi.mock("./auth-api", () => ({ changePasswordRequest: mocks.changePasswordRequest }));
vi.mock("./auth-token", () => ({ setAuthToken: mocks.setAuthToken }));

import { ChangePasswordDialog } from "./change-password-dialog";

const axiosError = (code: string) => ({ isAxiosError: true, response: { data: { error: { code } } } });

const renderDialog = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChangePasswordDialog open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
};

const fill = (current: string, next: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
};

describe("ChangePasswordDialog", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.changePasswordRequest.mockResolvedValue({ token: "fresh-token" });
  });

  it("renders the dialog fields", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("surfaces an incorrect current password on the field", async () => {
    mocks.changePasswordRequest.mockRejectedValue(axiosError("INVALID_PASSWORD"));
    renderDialog();
    fill("wrongpass1", "brandnewpass1", "brandnewpass1");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("The current password is incorrect.")).toBeInTheDocument();
    expect(mocks.setAuthToken).not.toHaveBeenCalled();
  });

  it("stores the fresh token and shows success on a successful change", async () => {
    renderDialog();
    fill("currentpass1", "brandnewpass1", "brandnewpass1");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(screen.getByText("Password changed successfully.")).toBeInTheDocument());
    expect(mocks.changePasswordRequest).toHaveBeenCalledWith({
      currentPassword: "currentpass1",
      newPassword: "brandnewpass1",
      confirmPassword: "brandnewpass1",
    });
    expect(mocks.setAuthToken).toHaveBeenCalledWith("fresh-token");
  });
});
