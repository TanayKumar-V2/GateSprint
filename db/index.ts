import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

function shouldUseNeon(url: string): boolean {
  if (process.env.USE_NEON === "true") return true;
  if (process.env.USE_NEON === "false") return false;
  return url.includes("neon.tech") || url.includes("neon.database");
}

/**
 * Shared Drizzle client. Hosted Neon goes through the serverless HTTP
 * driver; local Docker Postgres uses a node-postgres pool. Same schema
 * and queries either way.
 */
const url = connectionString();

export const db = shouldUseNeon(url)
  ? drizzleNeon(neon(url), { schema })
  : drizzlePg(new Pool({ connectionString: url }), { schema });

export type Db = typeof db;
