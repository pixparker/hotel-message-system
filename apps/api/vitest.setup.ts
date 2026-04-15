// Runs BEFORE any test imports — stub env so modules that validate env at
// module-load time can be imported in tests.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET ??= "a".repeat(40);
process.env.JWT_REFRESH_SECRET ??= "b".repeat(40);
process.env.API_PUBLIC_URL ??= "http://localhost:4000";
process.env.WEB_ORIGIN ??= "http://localhost:5173";
process.env.SECRETS_ENCRYPTION_KEY ??= "c".repeat(40);
process.env.LOG_LEVEL ??= "silent";
