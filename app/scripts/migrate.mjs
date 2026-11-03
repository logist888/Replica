import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url, ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined });
await client.connect();
await client.query(readFileSync(new URL("../db/pilot.sql", import.meta.url), "utf8"));
await client.end();
console.log("migrated");
