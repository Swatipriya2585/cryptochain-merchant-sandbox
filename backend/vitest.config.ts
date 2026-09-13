import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({
  path: path.resolve(__dirname, "../.env.sandbox"),
  override: true,
});
process.env.NODE_ENV = "sandbox";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "sandbox",
    },
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
