/**
 * Single source of the API base URL for every client → server call: the Axios
 * instance in `services/api-client.ts` and the SSE stream in `features/realtime`.
 *
 * Resolution order:
 *  - `VITE_API_URL` set   → use it verbatim, trailing slash trimmed
 *    (e.g. `https://<server-domain>/api`).
 *  - unset + dev build    → local server default, so `npm run dev` needs no `.env`.
 *  - unset + prod build   → throw. A deployed bundle with no API URL must fail
 *    loudly at startup, never silently fall back to `localhost`.
 *
 * Build-time constant: `VITE_API_URL` must be present at `vite build` time
 * (Vercel Project Environment Variables), not injected at runtime.
 */
const RAW = import.meta.env.VITE_API_URL?.trim();

function resolveApiBaseUrl(): string {
  if (RAW) return RAW.replace(/\/+$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000/api";
  throw new Error(
    "VITE_API_URL is not set. Define it in the deployment environment " +
      "(e.g. https://<server-domain>/api) and rebuild the client.",
  );
}

/** API origin + `/api` prefix, no trailing slash. Prepend paths as `/tickets`, `/auth/login`, … */
export const API_BASE_URL = resolveApiBaseUrl();

/** Server-Sent Events endpoint, derived from the same base — no `/api/api` duplication. */
export const REALTIME_EVENTS_URL = `${API_BASE_URL}/realtime/events`;
