import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// `dotenv/config` only reads `.env`, which this project doesn't use — real
// local secrets live in `.env.local`. On Vercel neither file exists and the
// values are already in `process.env`, which dotenv leaves untouched.
loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
