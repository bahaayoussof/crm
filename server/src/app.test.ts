import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("GET /api/health", () => {
  it("returns the API health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it.each(["http://localhost:5173", "http://localhost:5176"])("allows configured browser origin %s", async (origin) => {
    const response = await request(app).options("/api/auth/login").set("Origin", origin).set("Access-Control-Request-Method", "POST");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("does not allow an unconfigured browser origin", async () => {
    const response = await request(app).options("/api/auth/login").set("Origin", "http://localhost:5999").set("Access-Control-Request-Method", "POST");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
