const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env.sandbox"),
});

if (process.env.SKIP_PRISMA_PRETEST === "true") {
  console.log("SKIP_PRISMA_PRETEST=true — schema already applied via prisma migrate deploy");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing; cannot push Prisma schema.");
  process.exit(1);
}

const prismaCli = path.resolve(__dirname, "../node_modules/prisma/build/index.js");
const run = (args) => {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: path.resolve(__dirname, ".."),
  });
  if (result.status) {
    process.exit(result.status);
  }
};

run(["generate"]);

const migrationsDir = path.resolve(__dirname, "../prisma/migrations");
const dirs = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const dir of dirs) {
  const file = path.join(migrationsDir, dir, "migration.sql");
  if (fs.existsSync(file)) {
    run(["db", "execute", "--file", file, "--schema", "prisma/schema.prisma"]);
  }
}

run(["db", "push", "--skip-generate"]);
