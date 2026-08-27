import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { AppSelect, AppSelectField, type AppSelectOption } from "./app-select";

describe("AppSelect and AppSelectField", () => {
  beforeEach(() => {
    // Polyfill methods for Radix in jsdom
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!window.HTMLElement.prototype.hasPointerCapture) {
      window.HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!window.HTMLElement.prototype.setPointerCapture) {
      window.HTMLElement.prototype.setPointerCapture = vi.fn();
    }
    if (!window.HTMLElement.prototype.releasePointerCapture) {
      window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    }
  });

  afterEach(cleanup);

  const sampleOptions: AppSelectOption[] = [
    { value: "opt1", label: "Option One" },
    { value: "opt2", label: "Option Two", description: "Secondary info" },
    { value: "opt3", label: "Option Three", disabled: true },
  ];

  function openSelect(trigger: HTMLElement) {
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
  }

  it("1. renders label, placeholder, and selected option", () => {
    render(
      <AppSelectField
        id="test-select"
        label="Test Label"
        placeholder="Select something..."
        options={sampleOptions}
      />
    );

    expect(screen.getByLabelText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("Select something...")).toBeInTheDocument();
  });

  it("2. opens and closes on click/keyboard and renders options in a portal", async () => {
    render(
      <AppSelect
        id="portal-select"
        placeholder="Choose..."
        options={sampleOptions}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(screen.queryByRole("option", { name: /Option One/ })).not.toBeInTheDocument();

    openSelect(trigger);
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    const option1 = screen.getByRole("option", { name: /Option One/ });
    expect(option1).toBeInTheDocument();

    // Verify it is portalled into document.body
    expect(option1.closest("body")).toBe(document.body);
  });

  it("3. renders only one chevron icon and indicates open state", async () => {
    const { container } = render(
      <AppSelect
        id="chevron-select"
        placeholder="Choose..."
        options={sampleOptions}
      />
    );

    const chevrons = container.querySelectorAll("[data-slot='select-chevron']");
    expect(chevrons).toHaveLength(1);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("data-state", "closed");

    openSelect(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute("data-state", "open");
    });
  });

  it("4. renders a check indicator for the selected option", async () => {
    render(
      <AppSelect
        id="selected-check"
        value="opt2"
        options={sampleOptions}
      />
    );

    const trigger = screen.getByRole("combobox");
    openSelect(trigger);

    await waitFor(() => {
      const selectedOption = screen.getByRole("option", { name: /Option Two/ });
      expect(selectedOption).toHaveAttribute("aria-selected", "true");
      expect(selectedOption).toHaveAttribute("data-state", "checked");
    });
  });

  it("5. calls onValueChange upon selection", async () => {
    const handleChange = vi.fn();
    render(
      <AppSelect
        id="change-select"
        placeholder="Pick..."
        onValueChange={handleChange}
        options={sampleOptions}
      />
    );

    const trigger = screen.getByRole("combobox");
    openSelect(trigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Option One/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: /Option One/ }));
    expect(handleChange).toHaveBeenCalledWith("opt1");
  });

  it("6. supports empty string value mapping to safe internal sentinel and back", async () => {
    const handleChange = vi.fn();
    const filterOptions: AppSelectOption[] = [
      { value: "", label: "All items" },
      { value: "active", label: "Active" },
    ];

    render(
      <AppSelect
        id="filter-select"
        value=""
        onValueChange={handleChange}
        options={filterOptions}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("All items");

    openSelect(trigger);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Active" }));
    expect(handleChange).toHaveBeenCalledWith("active");
  });

  it("7. closes on Escape and returns focus to the trigger", async () => {
    render(
      <AppSelect
        id="escape-select"
        placeholder="Choose..."
        options={sampleOptions}
      />
    );

    const trigger = screen.getByRole("combobox");
    openSelect(trigger);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape", code: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("8. does not open when disabled and disables disabled options", async () => {
    render(
      <AppSelect
        id="disabled-select"
        disabled
        placeholder="Disabled..."
        options={sampleOptions}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();

    openSelect(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("9. associates error message, aria-invalid, and helper text with aria-describedby", () => {
    const { rerender } = render(
      <AppSelectField
        id="field-1"
        label="Category"
        helperText="Select a category for routing"
        options={sampleOptions}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-describedby", "field-1-helper");
    expect(screen.getByText("Select a category for routing")).toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-invalid", "true");

    rerender(
      <AppSelectField
        id="field-1"
        label="Category"
        error="Category is required"
        helperText="Select a category for routing"
        options={sampleOptions}
      />
    );

    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "field-1-error field-1-helper");
    expect(screen.getByRole("alert")).toHaveTextContent("Category is required");
  });

  it("10. updates displayed value when controlled value prop changes", () => {
    function ControlledWrapper() {
      const [val, setVal] = useState("opt1");
      return (
        <div>
          <button onClick={() => setVal("opt2")}>Switch</button>
          <AppSelect id="ctrl" value={val} onValueChange={setVal} options={sampleOptions} />
        </div>
      );
    }

    render(<ControlledWrapper />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Option One");

    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    expect(trigger).toHaveTextContent("Option Two");
  });

  it("11. integrates smoothly with React Hook Form Controller and reset", async () => {
    type FormValues = { role: string };
    const onSubmit = vi.fn();

    function TestForm() {
      const { control, handleSubmit, reset } = useForm<FormValues>({
        defaultValues: { role: "opt1" },
      });

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="role"
            control={control}
            render={({ field, fieldState }) => (
              <AppSelectField
                id="form-role"
                label="Role"
                value={field.value}
                onValueChange={field.onChange}
                error={fieldState.error?.message}
                options={sampleOptions}
              />
            )}
          />
          <button type="submit">Submit</button>
          <button type="button" onClick={() => reset({ role: "opt2" })}>
            Reset
          </button>
        </form>
      );
    }

    render(<TestForm />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Option One");

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ role: "opt1" }, expect.anything());
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(trigger).toHaveTextContent("Option Two");
  });
});
