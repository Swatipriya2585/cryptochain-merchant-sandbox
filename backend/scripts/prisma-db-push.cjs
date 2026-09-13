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
const generate = spawnSync(process.execPath, [prismaCli, "generate"], {
  stdio: "inherit",
  env: process.env,
});
if (generate.status) {
  process.exit(generate.status);
}

const push = spawnSync(process.execPath, [prismaCli, "db", "push", "--skip-generate"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(push.status ?? 1);
