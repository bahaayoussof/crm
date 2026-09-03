import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, isOriginAllowed } from "./app.js";

describe("GET /api/health", () => {
  it("returns the API health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    // `demo` is a non-secret deployment flag; false unless DEMO_MODE=true.
    expect(response.body).toEqual({ status: "ok", demo: false });
  });

  it.each(["http://localhost:5173", "http://localhost:5176", "http://localhost:5999", "http://127.0.0.1:4173", "http://[::1]:5173"])("allows local development browser origin %s", async (origin) => {
    const response = await request(app).options("/api/auth/login").set("Origin", origin).set("Access-Control-Request-Method", "POST");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("does not allow an unconfigured non-local browser origin", async () => {
    const response = await request(app).options("/api/auth/login").set("Origin", "https://unconfigured.example.com").set("Access-Control-Request-Method", "POST");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("isOriginAllowed (CORS origin decision)", () => {
  const configured = new Set(["https://crm-demo-bahaa.vercel.app", "https://crm-demo.bahaa.qzz.io"]);

  it("allows a request with no Origin header (curl, server-to-server, same-origin)", () => {
    expect(isOriginAllowed(undefined, { allowedOrigins: configured, allowLocalDev: false })).toBe(true);
  });

  it("allows an explicitly configured demo origin", () => {
    expect(isOriginAllowed("https://crm-demo-bahaa.vercel.app", { allowedOrigins: configured, allowLocalDev: false })).toBe(true);
    expect(isOriginAllowed("https://crm-demo.bahaa.qzz.io", { allowedOrigins: configured, allowLocalDev: false })).toBe(true);
  });

  it("rejects a random origin and an unconfigured *.vercel.app preview (no wildcard)", () => {
    expect(isOriginAllowed("https://evil.example.com", { allowedOrigins: configured, allowLocalDev: false })).toBe(false);
    expect(isOriginAllowed("https://crm-demo-bahaa-git-feature.vercel.app", { allowedOrigins: configured, allowLocalDev: false })).toBe(false);
  });

  it("allows localhost/loopback only when allowLocalDev is true (i.e. not in production)", () => {
    for (const origin of ["http://localhost:5173", "http://127.0.0.1:4173", "http://[::1]:5173"]) {
      expect(isOriginAllowed(origin, { allowedOrigins: configured, allowLocalDev: true })).toBe(true);
      expect(isOriginAllowed(origin, { allowedOrigins: configured, allowLocalDev: false })).toBe(false);
    }
  });
});
