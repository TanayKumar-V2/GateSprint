import {
  drizzle as drizzleNeon,
  type NeonHttpDatabase,
} from "drizzle-orm/neon-http";
import {
  drizzle as drizzlePg,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema> | NodePgDatabase<typeof schema>;

function shouldUseNeon(url: string): boolean {
  if (process.env.USE_NEON === "true") return true;
  if (process.env.USE_NEON === "false") return false;
  return url.includes("neon.tech") || url.includes("neon.database");
}

// Neither driver connects at construction time (Pool dials out on first
// query, neon() just stores credentials), so importing this module is
// always safe: `next build`, lint, and CI pass without any database
// configured. The first real query fails fast with a DNS error naming
// the host below if DATABASE_URL was never provided.
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://DATABASE_URL_is_not_set.invalid:5432/gate_mentor";

/**
 * Shared Drizzle client. Hosted Neon goes through the serverless HTTP
 * driver; local Docker Postgres uses a node-postgres pool. Same schema
 * and queries either way.
 */
export const db: Db = shouldUseNeon(connectionString)
  ? drizzleNeon(neon(connectionString), { schema })
  : drizzlePg(new Pool({ connectionString }), { schema });
