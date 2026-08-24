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

Never commit secrets.
