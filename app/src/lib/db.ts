import pg from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pool: pg.Pool | undefined;
}

export function pool(): pg.Pool {
  if (!globalThis.__pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalThis.__pool = new pg.Pool({
      connectionString: url,
      max: 5,
      ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalThis.__pool;
}
