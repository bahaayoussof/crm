import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";
import { LANGUAGE_STORAGE_KEY } from "@/lib/language";
import { LanguageSwitcher } from "./language-switcher";

describe("LanguageSwitcher", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await changeAppLanguage("en");
  });

  afterEach(cleanup);

  it("switches immediately between Arabic RTL and English LTR and persists the choice", async () => {
    render(<LanguageSwitcher />);

    const englishOption = screen.getByText("English");
    const arabicOption = screen.getByText("العربية");
    expect(englishOption).toHaveAttribute("lang", "en");
    expect(englishOption).toHaveAttribute("dir", "ltr");
    expect(arabicOption).toHaveAttribute("lang", "ar");
    expect(arabicOption).toHaveAttribute("dir", "rtl");

    expect(englishOption.closest("button")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(arabicOption);

    await waitFor(() => expect(document.documentElement).toHaveAttribute("dir", "rtl"));
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ar");
    expect(arabicOption.closest("button")).toHaveAttribute("aria-pressed", "true");
    expect(englishOption).toHaveAttribute("lang", "en");
    expect(englishOption).toHaveAttribute("dir", "ltr");

    fireEvent.click(englishOption);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("dir", "ltr"));
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });
});
