import express from "express";
import { Pool } from "pg";
import { getConfig } from "./config";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    const config = getConfig();
    res.json({
      status: "ok",
      service: "cryptochain-sandbox-backend",
      nodeEnv: config.nodeEnv,
    });
  });

  app.get("/health/db", async (_req, res) => {
    const { databaseUrl } = getConfig();
    if (!databaseUrl) {
      res.status(503).json({ status: "error", error: "DATABASE_URL is not set" });
      return;
    }

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "up" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "database unreachable";
      res.status(503).json({ status: "error", database: "down", error: message });
    } finally {
      await pool.end();
    }
  });

  return app;
}
