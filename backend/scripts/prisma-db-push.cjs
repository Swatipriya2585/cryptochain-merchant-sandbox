const path = require("node:path");
const { spawnSync } = require("node:child_process");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env.sandbox"),
});

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

const migration = path.resolve(
  __dirname,
  "../prisma/migrations/20260913120000_merchant_webhooks/migration.sql",
);
run(["db", "execute", "--file", migration, "--schema", "prisma/schema.prisma"]);
run(["db", "push", "--skip-generate"]);
