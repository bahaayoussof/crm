process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/crm_test";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";
process.env.NODE_ENV = "test";
process.env.CLIENT_URLS ??= "http://localhost:5173,http://localhost:5176";
