export interface LinkPopoverData {
  url: string;
  text: string;
  openInNewTab: boolean;
  isExisting: boolean;
}

export interface LinkSubmitPayload {
  url: string;
  text: string;
  openInNewTab: boolean;
}

export function validateLinkUrl(rawUrl: string): { valid: boolean; normalizedUrl?: string; errorKey?: "urlRequired" | "invalidUrl" } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, errorKey: "urlRequired" };
  }

  // Reject dangerous schemes: javascript:, data:, vbscript:, file:
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { valid: false, errorKey: "invalidUrl" };
  }

  // If starts with mailto: or tel:, check basic format
  if (/^mailto:/i.test(trimmed)) {
    const email = trimmed.slice(7).trim();
    if (!email || !email.includes("@")) {
      return { valid: false, errorKey: "invalidUrl" };
    }
    return { valid: true, normalizedUrl: `mailto:${email}` };
  }

  if (/^tel:/i.test(trimmed)) {
    const number = trimmed.slice(4).trim();
    if (!number) {
      return { valid: false, errorKey: "invalidUrl" };
    }
    return { valid: true, normalizedUrl: `tel:${number}` };
  }

  // If starts with http:// or https://
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname) {
        return { valid: false, errorKey: "invalidUrl" };
      }
      return { valid: true, normalizedUrl: trimmed };
    } catch {
      return { valid: false, errorKey: "invalidUrl" };
    }
  }

  // If no scheme provided (e.g. "example.com", "www.google.com/path"), prefix with https://
  try {
    const withScheme = `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return { valid: false, errorKey: "invalidUrl" };
    }
    return { valid: true, normalizedUrl: withScheme };
  } catch {
    return { valid: false, errorKey: "invalidUrl" };
  }
}
