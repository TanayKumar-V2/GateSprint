import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations always run against a direct Postgres connection
    // (local Docker or Neon pooled endpoint), never app code paths.
    url: process.env.DATABASE_URL ?? "",
  },
});
