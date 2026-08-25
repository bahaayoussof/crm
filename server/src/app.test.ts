import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("GET /api/health", () => {
  it("returns the API health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
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
