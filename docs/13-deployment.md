# Deployment

## Frontend
Vercel.

## API
Use a Vercel-compatible Node deployment if the Express setup supports the selected deployment pattern.

Do not rewrite the backend architecture solely for deployment without documenting the change.

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

### SLA monitor (`feature/sla-automation`)

- Deploy the server project with `server/vercel.json`; its Vercel Cron schedule calls `/api/internal/sla-monitor` every five minutes (`*/5 * * * *`).
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

Never commit secrets.
