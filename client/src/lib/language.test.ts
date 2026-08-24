import { afterEach, describe, expect, it } from "vitest";
import { LANGUAGE_STORAGE_KEY, persistLanguage, readStoredLanguage, resolveSupportedLanguage, syncDocumentLanguage } from "./language";

describe("language preference", () => {
  afterEach(() => {
    window.localStorage.clear();
    syncDocumentLanguage("en");
  });

  it("defaults invalid or missing saved values to English", () => {
    expect(readStoredLanguage()).toBe("en");
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    expect(readStoredLanguage()).toBe("en");
    expect(resolveSupportedLanguage("ar-EG")).toBe("en");
  });

  it("loads a saved Arabic preference", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "ar");
    expect(readStoredLanguage()).toBe("ar");
  });

  it("persists supported values and synchronizes document language and direction", () => {
    persistLanguage("ar");
    syncDocumentLanguage(readStoredLanguage());
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ar");
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");

    persistLanguage("en");
    syncDocumentLanguage(readStoredLanguage());
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });
});
