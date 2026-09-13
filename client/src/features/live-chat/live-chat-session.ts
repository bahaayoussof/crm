/**
 * CONV-050 — opaque Live Chat session key, persisted only for this browser
 * session/conversation lifecycle (per plan.md: `sessionStorage`, not
 * `localStorage`, which would outlive the intended scope). Starting a new
 * session rotates the key; resuming reuses the existing one. Customer
 * identity/login state alone never causes the client to attach to a
 * different, older active ticket — the server enforces this too (CONV-026).
 */
const STORAGE_KEY = "crm-live-chat-session-key";

function generateKey(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
}

/** Returns the current session key, minting and persisting one on first use. */
export function getLiveChatSessionKey(): string {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // sessionStorage unavailable (private mode, etc.) — fall through to a fresh in-memory key.
  }
  return rotateLiveChatSessionKey();
}

/** Mint and persist a brand-new session key (used when starting a fresh chat, or after the server reports the previous session ended). */
export function rotateLiveChatSessionKey(): string {
  const key = generateKey();
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    // ignore — the key still works for this in-memory call, just won't survive a reload
  }
  return key;
}
