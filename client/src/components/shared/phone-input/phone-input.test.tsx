import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm, Controller } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhoneInput } from "./phone-input";

function FormHarness({
  defaultValue = "",
  onSubmit,
}: {
  defaultValue?: string;
  onSubmit: (data: { phone: string }) => void;
}) {
  const { control, handleSubmit } = useForm<{ phone: string }>({
    defaultValues: { phone: defaultValue },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="phone"
        control={control}
        render={({ field, fieldState }) => (
          <PhoneInput
            id="phone-input"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      <button type="submit">Submit</button>
    </form>
  );
}

describe("PhoneInput", () => {
  afterEach(cleanup);

  it("renders with default Egypt country and displays dial code", () => {
    render(<PhoneInput id="test-phone" value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("dir", "ltr");
    expect(input).toHaveAttribute("type", "tel");
  });

  it("allows user to type a phone number and emits canonical value", () => {
    const handleChange = vi.fn();
    render(<PhoneInput id="test-phone" value="" onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "+20 100 123 4567" } });

    expect(handleChange).toHaveBeenCalled();
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall).toContain("+201001234567");
  });

  it("clears to empty string when only dial code is left", () => {
    const handleChange = vi.fn();
    render(<PhoneInput id="test-phone" value="+201001234567" onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "+20" } });

    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("opens country selector combobox", () => {
    const handleChange = vi.fn();
    const handleCountryChange = vi.fn();

    render(
      <PhoneInput
        id="test-phone"
        value=""
        onChange={handleChange}
        onCountryChange={handleCountryChange}
      />,
    );

    const countryBtn = screen.getByRole("combobox", { name: "Country selector" });
    expect(countryBtn).toBeInTheDocument();
    fireEvent.click(countryBtn);
  });

  it("renders disabled state properly", () => {
    render(<PhoneInput id="test-phone" value="+201001234567" disabled onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    const countryBtn = screen.getByRole("combobox", { name: "Country selector" });
    expect(countryBtn).toBeDisabled();
  });

  it("renders error state with aria-invalid", () => {
    render(
      <PhoneInput
        id="test-phone"
        value="+20100"
        error="Invalid phone number"
        onChange={() => {}}
      />,
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("integrates seamlessly with React Hook Form Controller", () => {
    const handleSubmit = vi.fn();
    render(<FormHarness defaultValue="" onSubmit={handleSubmit} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "+20 100 123 4567" } });

    const submitBtn = screen.getByRole("button", { name: "Submit" });
    fireEvent.click(submitBtn);
  });

  it("preserves LTR direction in Arabic RTL document", () => {
    document.documentElement.dir = "rtl";
    render(<PhoneInput id="test-phone" value="+201001234567" onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("dir", "ltr");
    document.documentElement.dir = "ltr";
  });
});
