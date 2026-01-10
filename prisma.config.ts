import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/tb_masdarutama?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: databaseUrl,
  },
});