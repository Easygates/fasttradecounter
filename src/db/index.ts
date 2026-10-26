import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const globalForDb = globalThis as typeof globalThis & { __picklanePool?: Pool };
export const pool = globalForDb.__picklanePool ??= new Pool({ connectionString: databaseUrl, max: 12, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 15000, application_name: "picklane" });
pool.on("error", (error) => console.error("[Picklane] Idle database connection error", error.message));
export const db = drizzle(pool);
