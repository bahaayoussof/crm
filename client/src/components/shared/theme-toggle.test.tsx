import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders theme options and allows selecting Dark mode", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const darkBtn = screen.getByRole("button", { name: /dark|theme\.dark|داكن/i });
    expect(darkBtn).toBeInTheDocument();

    fireEvent.click(darkBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("crm-theme")).toBe("dark");
  });

  it("renders menu variant and handles theme switching", () => {
    render(
      <ThemeProvider>
        <ThemeToggle variant="menu" />
      </ThemeProvider>
    );

    const lightBtn = screen.getByRole("button", { name: /light|theme\.light|فاتح/i });
    fireEvent.click(lightBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("crm-theme")).toBe("light");
  });
});
