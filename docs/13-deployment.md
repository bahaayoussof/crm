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

### Attachment storage (`feature/attachments`)

- `BLOB_READ_WRITE_TOKEN` — read/write token for a **private** Vercel Blob store, consumed by the server-side `@vercel/blob` adapter. Server-side only; never exposed to the browser and never returned in any API response.
- Optional. When unset, attachment upload and download return a structured `503 STORAGE_UNAVAILABLE`; the rest of the app is unaffected. There is no fallback to public Blob access or local-disk storage.
- Server-proxied multipart upload is capped at 4 MiB per request, keeping it below the common Vercel serverless request-body limit; a larger limit would require an explicitly designed direct-client upload flow.
- The legacy `server/uploads/` directory and its `.gitignore` rules are unused by this feature and are retained only as pre-Blob scaffolding.

Never commit secrets.
