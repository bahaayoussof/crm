# Deployment

## Frontend
Vercel.

## API

The Express app is deployed as a single Vercel serverless function.

- `server/src/app.ts` builds and exports the Express `app` (no listener, no
  lifecycle side effects).
- `server/src/server.ts` is the persistent Node host (`app.listen`, signal
  handlers) — used by `npm run dev`, `npm start`, and any non-Vercel host.
- `server/api/index.ts` is the Vercel entrypoint: it re-exports the same `app`
  (`import app from "../src/app.js"; export default app;`). No routes/middleware
  are re-declared.
- `server/vercel.json` rewrites every path to `/api`, sets
  `buildCommand: "prisma generate"`, and `functions["api/index.ts"].maxDuration`
  to 60s. It contains **no `crons` array**.
- `@vercel/node` transpiles `api/index.ts`; it is type-checked via
  `server/tsconfig.vercel.json` (wired into `npm run typecheck`). The `src → dist`
  build (`npm run build`) is unchanged and used only by the persistent host.

See ADR-053 and ADR-054. Do not rewrite the backend architecture solely for
deployment without documenting the change.

## Database
Managed PostgreSQL.

Preferred assessment option:
- Neon

## Environment Variables

Expected categories:
- DATABASE_URL
- JWT_SECRET
- frontend/API base URLs
- AI provider credentials if AI is enabled
- storage credentials if external attachment storage is used
- `CRON_SECRET` for deployment-scheduler authentication

### Public demo deployment (`feature/demo-environment`)

The portfolio demo is this same app with `DEMO_MODE=true` / `VITE_DEMO_MODE=true`
plus an isolated demo database (`DATABASE_ENV=demo`). It targets **Vercel Hobby**,
so `server/vercel.json` no longer declares the `*/5 * * * *` cron jobs (Hobby
allows cron only once per day). The `/api/internal/*` endpoints and all SLA /
task-reminder / live-chat-inactivity logic are unchanged and still
`CRON_SECRET`-protected — they are simply not auto-triggered. Outbound WhatsApp /
SMS / Email are simulated at the adapter boundary (no credentials needed). Full
detail, env-var tables and the `demo:seed` / `demo:reset` scripts:
`docs/26-demo-environment.md`.

### SLA monitor (`feature/sla-automation`)

- Deploy the server project with `server/vercel.json`; on a **non-Hobby** plan add a Vercel Cron schedule calling `/api/internal/sla-monitor` every five minutes (`*/5 * * * *`). The public demo (Hobby) omits this — see the demo section above.
- Set `CRON_SECRET` to a distinct random value of at least 32 characters in the server deployment. Vercel sends it as `Authorization: Bearer <CRON_SECRET>` for cron invocations.
- Do not reuse `JWT_SECRET`, expose the value to the client, or invoke this endpoint from product UI.
- The endpoint is idempotent and batch-bounded, but the deployment must still provide the configured PostgreSQL connection and a Vercel-compatible server entry.

### Attachment storage (`feature/attachments`)

- `BLOB_READ_WRITE_TOKEN` — read/write token for a **private** Vercel Blob store, consumed by the server-side `@vercel/blob` adapter. Server-side only; never exposed to the browser and never returned in any API response.
- Optional. When unset, attachment upload and download return a structured `503 STORAGE_UNAVAILABLE`; the rest of the app is unaffected. There is no fallback to public Blob access or local-disk storage.
- Server-proxied multipart upload is capped at 4 MiB per request, keeping it below the common Vercel serverless request-body limit; a larger limit would require an explicitly designed direct-client upload flow.
- The legacy `server/uploads/` directory and its `.gitignore` rules are unused by this feature and are retained only as pre-Blob scaffolding.

### WhatsApp Cloud API (`feature/whatsapp-integration`)

- `WHATSAPP_ACCESS_TOKEN` — bearer token for the WhatsApp Business phone number (outbound replies).
- `WHATSAPP_PHONE_NUMBER_ID` — the Phone Number **ID** (not the phone number) from the Meta app (outbound replies).
- `WHATSAPP_VERIFY_TOKEN` — arbitrary string; also pasted into the Meta webhook "Verify token" field (webhook GET verification).
- `WHATSAPP_APP_SECRET` — the Meta **App Secret**; verifies the `X-Hub-Signature-256` header on inbound webhooks.
- `WHATSAPP_API_VERSION` — Graph API version; optional, defaults to `v22.0`.
- All five are **optional**. When unset, the CRM runs unchanged and the WhatsApp endpoints return `503 WHATSAPP_NOT_CONFIGURED`. Server-side only; never exposed to the browser or returned in any response.
- The webhook needs a public **HTTPS** URL: `https://<api-domain>/api/integrations/whatsapp/webhook`. Subscribe the Meta app to the **`messages`** webhook field only. The hostname is never hard-coded in application logic.
- Full setup steps: `docs/20-whatsapp-integration.md`.

## Realtime events (SSE) — `feature/realtime-events`

- `GET /api/realtime/events` is a long-lived `text/event-stream` response (25s
  heartbeat comment, client auto-reconnect). No new env var, no schema change.
- **Persistent Node host** (Render / Railway / Fly / container): full support.
- **Vercel serverless**: each function invocation is bounded by `maxDuration`, so
  the SSE response is force-closed at that limit and the client reconnects every
  few minutes (functional, not ideal). For production realtime, run the API as a
  persistent Node service, or use Vercel Fluid Compute with an extended
  `maxDuration`, or replace the SSE transport with a managed realtime provider
  (the `realtime.publisher` seam keeps domain code unchanged).
- Set `X-Accel-Buffering: no` is sent by the endpoint; a buffering CDN/proxy in
  front of the API would still delay events.
- See `docs/22-realtime-events.md` and ADR-045.

Never commit secrets.

## Resend EMAIL channel

Development does not require a custom domain: configure a Resend-managed
`*.resend.app` receiving address, `email.received` webhook, signing secret, API
key, and provider-supported test sender. Production later requires verifying the
sending/receiving domain and updating `EMAIL_FROM` / `EMAIL_INBOUND_ADDRESS`
only. See `docs/21-email-integration.md`; never deploy Resend or Blob secrets to
the frontend environment.
