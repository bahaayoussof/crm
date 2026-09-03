import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  beforeEach(async () => {
    await changeAppLanguage("en");
  });
  afterEach(cleanup);

  it("defaults to type=password and renders the show (Eye) affordance", () => {
    render(<PasswordInput aria-label="Password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("toggles to type=text and back, swapping the accessible label", () => {
    render(<PasswordInput aria-label="Password" />);
    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("uses a non-submitting button", () => {
    render(<PasswordInput aria-label="Password" />);
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("type", "button");
  });

  it("does not submit the surrounding form when toggled", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Password" />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("forwards native input props (name, id, autoComplete, placeholder)", () => {
    render(
      <PasswordInput
        id="pw"
        name="password"
        autoComplete="current-password"
        placeholder="Enter password"
      />,
    );
    const input = screen.getByPlaceholderText("Enter password");
    expect(input).toHaveAttribute("id", "pw");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
  });

  it("keeps the input LTR by default but honours an explicit dir", () => {
    const { rerender } = render(<PasswordInput aria-label="Password" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("dir", "ltr");
    rerender(<PasswordInput aria-label="Password" dir="rtl" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("dir", "rtl");
  });

  it("pins the toggle to the physical right and pads the input on the right", () => {
    render(<PasswordInput aria-label="Password" />);
    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(input.className).toContain("pr-11");
    expect(input.className).not.toContain("pe-11");
    expect(toggle.className).toContain("right-0");
    expect(toggle.className).not.toContain("end-0");
    expect(toggle.className).not.toContain("inset-inline-end");
  });

  it("uses the same physical right-side classes regardless of document direction", async () => {
    document.documentElement.dir = "ltr";
    const { rerender } = render(<PasswordInput aria-label="Password" />);
    const ltrInputClass = screen.getByLabelText("Password").className;
    const ltrToggleClass = screen.getByRole("button", { name: "Show password" }).className;

    await changeAppLanguage("ar");
    document.documentElement.dir = "rtl";
    rerender(<PasswordInput aria-label="Password" />);
    const rtlInput = screen.getByLabelText("Password");
    const rtlToggle = screen.getByRole("button", { name: "إظهار كلمة المرور" });

    expect(rtlInput.className).toBe(ltrInputClass);
    expect(rtlToggle.className).toBe(ltrToggleClass);
    expect(rtlInput.className).toContain("pr-11");
    expect(rtlToggle.className).toContain("right-0");

    document.documentElement.dir = "ltr";
  });

  it("disables the toggle when the input is disabled", () => {
    render(<PasswordInput aria-label="Password" disabled />);
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show password" })).toBeDisabled();
  });

  it("forwards a ref to the underlying input", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<PasswordInput aria-label="Password" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("translates the accessible label in Arabic", async () => {
    await changeAppLanguage("ar");
    render(<PasswordInput aria-label="Password" />);
    expect(screen.getByRole("button", { name: "إظهار كلمة المرور" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إظهار كلمة المرور" }));
    expect(screen.getByRole("button", { name: "إخفاء كلمة المرور" })).toBeInTheDocument();
  });

  it("gives each field independent visibility state in a multi-password form", () => {
    function MultiForm() {
      useForm();
      return (
        <>
          <PasswordInput aria-label="Current" />
          <PasswordInput aria-label="New" />
        </>
      );
    }
    render(<MultiForm />);
    const current = screen.getByLabelText("Current");
    const next = screen.getByLabelText("New");

    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]!);
    expect(current).toHaveAttribute("type", "text");
    expect(next).toHaveAttribute("type", "password");
  });
});
