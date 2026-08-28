import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/lib/i18n";
import { changeAppLanguage } from "@/lib/i18n";
import { DatePicker } from "./date-picker";
import { DateRangePicker } from "./date-range-picker";
import {
  buildMonthGrid,
  formatDisplayRange,
  isDisabledDay,
  weekStartFor,
  type DateRange,
} from "./date-picker-utils";

beforeEach(() => {
  const proto = window.HTMLElement.prototype;
  if (!proto.scrollIntoView) proto.scrollIntoView = vi.fn();
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = vi.fn();
  if (!proto.releasePointerCapture) proto.releasePointerCapture = vi.fn();
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

afterEach(async () => {
  cleanup();
  await changeAppLanguage("en");
});

const AUG_2026 = new Date(2026, 7, 15);

describe("date-picker-utils", () => {
  it("builds a stable 42-cell month grid aligned to the week start", () => {
    const grid = buildMonthGrid(AUG_2026, weekStartFor("en"));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(0); // Sunday for English
  });

  it("aligns the Arabic grid to Saturday", () => {
    const grid = buildMonthGrid(AUG_2026, weekStartFor("ar"));
    expect(grid[0].getDay()).toBe(6);
  });

  it("flags days outside the min/max bounds as disabled", () => {
    const min = new Date(2026, 7, 10);
    const max = new Date(2026, 7, 20);
    expect(isDisabledDay(new Date(2026, 7, 9), min, max)).toBe(true);
    expect(isDisabledDay(new Date(2026, 7, 15), min, max)).toBe(false);
    expect(isDisabledDay(new Date(2026, 7, 21), min, max)).toBe(true);
  });

  it("formats a range label", () => {
    const label = formatDisplayRange(
      { from: new Date(2026, 7, 20), to: new Date(2026, 7, 28) },
      "en",
    );
    expect(label).toContain("Aug 20, 2026");
    expect(label).toContain("Aug 28, 2026");
  });
});

describe("DatePicker", () => {
  it("shows the placeholder when empty and the formatted value when set", () => {
    const { rerender } = render(<DatePicker value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("Select date")).toBeInTheDocument();

    rerender(<DatePicker value={new Date(2026, 7, 28)} onChange={vi.fn()} />);
    expect(screen.getByText("Aug 28, 2026")).toBeInTheDocument();
  });

  it("opens a dialog on click and selecting a day calls onChange then closes", async () => {
    const onChange = vi.fn();
    render(<DatePicker value={new Date(2026, 7, 15)} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /aug 15, 2026/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /august 28, 2026/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0][0] as Date;
    expect(emitted.getFullYear()).toBe(2026);
    expect(emitted.getMonth()).toBe(7);
    expect(emitted.getDate()).toBe(28);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not select a day outside the max bound", async () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value={new Date(2026, 7, 10)}
        onChange={onChange}
        maxDate={new Date(2026, 7, 15)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /aug 10, 2026/i }));
    const dialog = await screen.findByRole("dialog");
    const disabledDay = within(dialog).getByRole("button", { name: /august 20, 2026/i });
    expect(disabledDay).toBeDisabled();
    fireEvent.click(disabledDay);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the value from the footer action", async () => {
    const onChange = vi.fn();
    render(<DatePicker value={new Date(2026, 7, 15)} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /aug 15, 2026/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("keeps the picker open while interacting with the month dropdown", async () => {
    render(<DatePicker value={new Date(2026, 7, 15)} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /aug 15, 2026/i }));
    const dialog = await screen.findByRole("dialog");

    // Open the nested month list.
    fireEvent.click(within(dialog).getByRole("button", { name: "Month" }));
    expect(within(dialog).getByRole("listbox", { name: "Month" })).toBeInTheDocument();

    // Click inside the picker (the grid) without choosing a month.
    fireEvent.pointerDown(within(dialog).getByRole("grid"));

    // Nested list closed, but the picker itself stayed open.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).queryByRole("listbox", { name: "Month" })).not.toBeInTheDocument(),
    );
  });

  it("changes the visible month from the month dropdown", async () => {
    render(<DatePicker value={new Date(2026, 7, 15)} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /aug 15, 2026/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Month" }));
    fireEvent.click(within(dialog).getByRole("option", { name: "January" }));

    expect(within(dialog).getByRole("button", { name: "Month" })).toHaveTextContent("January");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders under RTL when the language is Arabic", async () => {
    await changeAppLanguage("ar");
    render(<DatePicker value={undefined} onChange={vi.fn()} />);
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByText("اختر التاريخ")).toBeInTheDocument();
  });
});

describe("DateRangePicker", () => {
  it("selects a start then an end date and applies the range", async () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker value={{}} onChange={onChange} minDate={new Date(2026, 7, 1)} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select date range" }));
    const dialog = await screen.findByRole("dialog");

    // Single-month layout: assert the interaction contract using the visible month's days.
    const dayButtons = within(dialog)
      .getAllByRole("button")
      .filter((node) => /\d{1,2},\s\d{4}$/.test(node.getAttribute("aria-label") ?? ""));
    expect(dayButtons.length).toBeGreaterThan(10);

    fireEvent.click(dayButtons[5]);
    fireEvent.click(dayButtons[9]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const range = onChange.mock.calls[0][0] as DateRange;
    expect(range.from).toBeInstanceOf(Date);
    expect(range.to).toBeInstanceOf(Date);
    expect(range.to!.getTime()).toBeGreaterThanOrEqual(range.from!.getTime());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("applies a preset immediately and closes", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{}} onChange={onChange} presets />);

    fireEvent.click(screen.getByRole("button", { name: "Select date range" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Last 7 days" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const range = onChange.mock.calls[0][0] as DateRange;
    expect(range.from).toBeInstanceOf(Date);
    expect(range.to).toBeInstanceOf(Date);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("clears an existing range", async () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{ from: new Date(2026, 7, 20), to: new Date(2026, 7, 28) }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /aug 20, 2026/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it("renders a single month only (no two-column layout)", async () => {
    render(<DateRangePicker value={{}} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select date range" }));
    const dialog = await screen.findByRole("dialog");
    // 7 weekday column headers for one month; a 2-month layout would render 14.
    expect(within(dialog).getAllByRole("columnheader")).toHaveLength(7);
  });
});

describe("DatePicker with showTime", () => {
  it("keeps the popover open after a day is chosen and commits date+time on Apply", async () => {
    const onChange = vi.fn();
    render(
      <DatePicker value={new Date(2026, 7, 15, 9, 0)} onChange={onChange} showTime minuteStep={15} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /aug 15, 2026/i }));
    const dialog = await screen.findByRole("dialog");

    // Time selectors are present.
    expect(within(dialog).getByLabelText("Hours")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Minutes")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /august 20, 2026/i }));
    // Still open — no commit yet.
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0][0] as Date;
    expect(emitted.getFullYear()).toBe(2026);
    expect(emitted.getMonth()).toBe(7);
    expect(emitted.getDate()).toBe(20);
    expect(emitted.getHours()).toBe(9);
    expect(emitted.getMinutes()).toBe(0);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the localized date+time label for the current value", () => {
    render(<DatePicker value={new Date(2026, 7, 28, 14, 30)} onChange={vi.fn()} showTime />);
    expect(screen.getByText(/Aug 28, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/2:30/)).toBeInTheDocument();
  });
});
