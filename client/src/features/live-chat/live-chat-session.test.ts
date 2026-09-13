import { describe, expect, it, beforeEach } from "vitest";
import { getLiveChatSessionKey, rotateLiveChatSessionKey } from "./live-chat-session";

describe("live-chat-session — CONV-050", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("mints and persists a session key on first use", () => {
    const key = getLiveChatSessionKey();
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(getLiveChatSessionKey()).toBe(key);
  });

  it("rotateLiveChatSessionKey mints a new, different key and persists it", () => {
    const first = getLiveChatSessionKey();
    const rotated = rotateLiveChatSessionKey();
    expect(rotated).not.toBe(first);
    expect(getLiveChatSessionKey()).toBe(rotated);
  });

  it("uses sessionStorage, not localStorage — key does not leak across a simulated new browser session", () => {
    const key = getLiveChatSessionKey();
    expect(sessionStorage.getItem("crm-live-chat-session-key")).toBe(key);
    expect(localStorage.getItem("crm-live-chat-session-key")).toBeNull();
  });
});
