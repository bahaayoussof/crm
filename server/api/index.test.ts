import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";
import serverlessApp from "./index.js";

/**
 * Deployment-safety contract for the app / persistent-server / serverless split.
 *
 *  - `src/app.ts`     : the Express application. No listener, no lifecycle.
 *  - `src/server.ts`  : the ONLY place `app.listen(...)` and `process.on(...)` live.
 *  - `api/index.ts`   : the Vercel entrypoint — re-exports the same `app`, nothing else.
 */
describe("Vercel serverless adapter", () => {
  it("re-exports the exact same Express app instance (no second app, no re-declared routes)", () => {
    expect(serverlessApp).toBe(app);
  });

  it("is a request handler function that serves the real router (GET /api/health)", async () => {
    const response = await request(serverlessApp).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", demo: false });
  });

  it("app.ts contains no app.listen / setInterval / process.on — importing it starts nothing", () => {
    const appSource = readFileSync(fileURLToPath(new URL("../src/app.ts", import.meta.url)), "utf8");
    expect(appSource).not.toMatch(/\.listen\s*\(/);
    expect(appSource).not.toMatch(/setInterval\s*\(/);
    expect(appSource).not.toMatch(/process\.on\s*\(/);
  });

  it("the Vercel entrypoint only imports the app and default-exports it", () => {
    const apiSource = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    const code = apiSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").trim();
    expect(code).toBe('import app from "../src/app.js";\n\nexport default app;');
    expect(code).not.toMatch(/express\s*\(/);
    expect(code).not.toMatch(/\.use\s*\(/);
    expect(code).not.toMatch(/\.listen\s*\(/);
  });

  it("server.ts is the sole owner of listen() and signal handlers", () => {
    const serverSource = readFileSync(fileURLToPath(new URL("../src/server.ts", import.meta.url)), "utf8");
    expect(serverSource).toMatch(/app\.listen\(/);
    expect(serverSource).toMatch(/process\.on\("SIG/);
  });
});
