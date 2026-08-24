import { afterEach, describe, expect, it, vi } from "vitest";
import { LANGUAGE_STORAGE_KEY } from "./language";

describe("i18n initialization", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it("applies a saved Arabic preference during initialization", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "ar");
    const localization = await import("./i18n");
    await localization.i18nReady;

    expect(localization.default.resolvedLanguage).toBe("ar");
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(document.title).toBe("نظام إدارة دعم العملاء");
  });

  it("falls back safely when the saved language is unsupported", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    const localization = await import("./i18n");
    await localization.i18nReady;

    expect(localization.default.resolvedLanguage).toBe("en");
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(document.title).toBe("Customer Support CRM");
  });
});
