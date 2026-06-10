import path from "node:path";
import { defineConfig } from "prisma/config";
import { config as loadDotenv } from "dotenv";

// Load .env.local first (takes priority), then .env as fallback
loadDotenv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadDotenv({ path: path.resolve(process.cwd(), ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
