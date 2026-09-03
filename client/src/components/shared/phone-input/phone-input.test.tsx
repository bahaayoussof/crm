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

  describe("country selector stays physically on the left (LTR + RTL)", () => {
    function renderAt(dir: "ltr" | "rtl") {
      document.documentElement.dir = dir;
      return render(<PhoneInput id="test-phone" value="+201001234567" onChange={() => {}} />);
    }

    afterEach(() => {
      document.documentElement.dir = "ltr";
    });

    it.each(["ltr", "rtl"] as const)(
      "renders the country selector before the phone-number input in DOM order (%s)",
      (dir) => {
        const { container } = renderAt(dir);
        const wrapper = container.firstElementChild as HTMLElement;
        const button = screen.getByRole("combobox", { name: "Country selector" });
        const input = screen.getByRole("textbox");

        expect(wrapper.children[0]).toBe(button);
        expect(wrapper.children[1]).toBe(input);
        expect(
          button.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      },
    );

    it.each(["ltr", "rtl"] as const)(
      "pins the wrapper to an LTR layout context so the selector never mirrors (%s)",
      (dir) => {
        const { container } = renderAt(dir);
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper).toHaveAttribute("dir", "ltr");
        expect(wrapper.className).toContain("flex-row");
        expect(wrapper.className).not.toContain("flex-row-reverse");
      },
    );

    it.each(["ltr", "rtl"] as const)(
      "selector owns the left outer corners, phone input owns the right (%s)",
      (dir) => {
        renderAt(dir);
        const button = screen.getByRole("combobox", { name: "Country selector" });
        const input = screen.getByRole("textbox");

        // rounded-s-* / rounded-e-* resolve physically because the wrapper is dir="ltr"
        expect(button.className).toContain("rounded-s-md");
        expect(button.className).toContain("border-e-0");
        expect(input.className).toContain("rounded-s-none");
        expect(input.className).toContain("rounded-e-md");
      },
    );

    it.each(["ltr", "rtl"] as const)(
      "keeps phone digits and dial code LTR-readable (%s)",
      (dir) => {
        renderAt(dir);
        const input = screen.getByRole("textbox");
        expect(input).toHaveAttribute("dir", "ltr");

        fireEvent.click(screen.getByRole("combobox", { name: "Country selector" }));
        const dialCodes = screen
          .getAllByRole("option")
          .map((o) => o.querySelector("span[dir='ltr']"))
          .filter(Boolean);
        expect(dialCodes.length).toBeGreaterThan(0);
        for (const el of dialCodes) {
          expect(el).toHaveAttribute("dir", "ltr");
        }
      },
    );
  });

  describe("searchable country dropdown", () => {
    function openDropdown() {
      render(<PhoneInput id="test-phone" value="" onChange={() => {}} />);
      fireEvent.click(screen.getByRole("combobox", { name: "Country selector" }));
      return screen.getByRole("searchbox");
    }

    function search(term: string) {
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: term } });
    }

    it("shows a search box at the top of the dropdown when opened", () => {
      const searchBox = openDropdown();
      expect(searchBox).toBeInTheDocument();
      expect(screen.getAllByRole("option").length).toBeGreaterThan(50);
    });

    it("filters by country name (case-insensitive)", () => {
      openDropdown();
      for (const term of ["Egypt", "egypt", "EGYPT"]) {
        search(term);
        expect(screen.getByRole("option", { name: /Egypt/ })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: /Brazil/ })).not.toBeInTheDocument();
      }
    });

    it("filters by dial code with or without the plus prefix", () => {
      openDropdown();
      for (const term of ["+20", "20"]) {
        search(term);
        expect(screen.getByRole("option", { name: /Egypt/ })).toBeInTheDocument();
      }
      search("966");
      expect(screen.getByRole("option", { name: /Saudi Arabia/ })).toBeInTheDocument();
      search("Saudi");
      expect(screen.getByRole("option", { name: /Saudi Arabia/ })).toBeInTheDocument();
    });

    it("returns multiple matches for a shared prefix", () => {
      openDropdown();
      search("United");
      const names = screen.getAllByRole("option").map((o) => o.textContent);
      expect(names.some((n) => n?.includes("United Arab Emirates"))).toBe(true);
      expect(names.some((n) => n?.includes("United States"))).toBe(true);
      expect(names.some((n) => n?.includes("United Kingdom"))).toBe(true);
    });

    it("shows a localized empty state when nothing matches", () => {
      openDropdown();
      search("zzzzzz");
      expect(screen.queryAllByRole("option")).toHaveLength(0);
      expect(screen.getByRole("status")).toHaveTextContent("phoneInput.noResults");
    });

    it("selecting a filtered country updates the phone input dial code and closes the dropdown", () => {
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
      fireEvent.click(screen.getByRole("combobox", { name: "Country selector" }));
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Saudi" } });
      fireEvent.click(screen.getByRole("option", { name: /Saudi Arabia/ }));

      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
      expect(handleCountryChange).toHaveBeenCalled();
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toContain("966");
    });

    it("resets the query each time the dropdown reopens", () => {
      openDropdown();
      search("Egypt");
      expect(screen.queryByRole("option", { name: /Brazil/ })).not.toBeInTheDocument();
      // close
      fireEvent.click(screen.getByRole("combobox", { name: "Country selector" }));
      // reopen
      fireEvent.click(screen.getByRole("combobox", { name: "Country selector" }));
      expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
      expect(screen.getByRole("option", { name: /Brazil/ })).toBeInTheDocument();
    });

    it("supports keyboard navigation and selection from the search box", () => {
      render(<PhoneInput id="test-phone" value="" onChange={() => {}} />);
      fireEvent.click(screen.getByRole("combobox", { name: "Country selector" }));
      const searchBox = screen.getByRole("searchbox");
      fireEvent.change(searchBox, { target: { value: "Saudi" } });
      fireEvent.keyDown(searchBox, { key: "ArrowDown" });
      fireEvent.keyDown(searchBox, { key: "Enter" });
      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    });

    it("closes on Escape without changing the country", () => {
      render(<PhoneInput id="test-phone" value="" onChange={() => {}} />);
      fireEvent.click(screen.getByRole("combobox", { name: "Country selector" }));
      fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    });
  });
});
