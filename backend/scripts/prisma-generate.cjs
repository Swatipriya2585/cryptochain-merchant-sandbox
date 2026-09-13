const path = require("node:path");
const { spawnSync } = require("node:child_process");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env.sandbox"),
});

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing; cannot generate Prisma client.");
  process.exit(1);
}

const prismaCli = path.resolve(__dirname, "../node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
