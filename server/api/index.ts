/**
 * Vercel serverless entrypoint for the CRM API.
 *
 * This is the ONLY file that is specific to the Vercel deployment. It adds no
 * routes, no middleware, no error handling and no second Express app — it simply
 * re-exports the one application constructed in `src/app.ts`. An Express app is
 * itself a `(req, res)` request handler, which is exactly the shape
 * `@vercel/node` expects as a function's default export, so every request that
 * Vercel routes to `/api` (see `vercel.json` `rewrites`) is handled by the full
 * middleware chain and router tree defined in `src/app.ts`.
 *
 * Local development and any persistent Node host still use `src/server.ts`
 * (`app.listen`). Importing this module — or `src/app.ts` — never starts a
 * listener.
 */
import app from "../src/app.js";

export default app;
