import { config } from "../config/env";
import { logger } from "./logger";

export type AlertSeverity = "warning" | "error";

export type OpsAlert = {
  title: string;
  body: string;
  severity?: AlertSeverity;
  fields?: Record<string, string>;
  /** Dedupe key so repeated webhook failures do not flood Slack/Discord. */
  dedupeKey?: string;
};

export type AlertFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

export type AlertDeps = {
  fetch?: AlertFetch;
  now?: () => number;
  webhookUrl?: string | undefined;
};

const DEDUPE_WINDOW_MS = 5 * 60_000;
const lastSentAt = new Map<string, number>();

export function resetAlertDedupeForTests(): void {
  lastSentAt.clear();
}

export function detectAlertTarget(url: string): "slack" | "discord" | "generic" {
  const value = url.toLowerCase();
  if (value.includes("hooks.slack.com")) {
    return "slack";
  }
  if (value.includes("discord.com/api/webhooks") || value.includes("discordapp.com/api/webhooks")) {
    return "discord";
  }
  return "generic";
}

export function buildAlertBody(
  alert: OpsAlert,
  webhookUrl?: string,
): { contentType: string; body: string } {
  const severity = alert.severity ?? "error";
  const fieldLines = Object.entries(alert.fields ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const text = [
    `[${severity.toUpperCase()}] ${alert.title}`,
    alert.body,
    fieldLines,
    `mode=${config.mode} chain=${config.chain}`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  const target = webhookUrl ? detectAlertTarget(webhookUrl) : "generic";
  const json =
    target === "discord"
      ? { content: text }
      : target === "slack"
        ? { text }
        : { text, content: text };

  return {
    contentType: "application/json",
    body: JSON.stringify(json),
  };
}

/**
 * Fire-and-forget Slack or Discord incoming webhook.
 * No-ops when ALERT_WEBHOOK_URL is unset (sandbox default).
 */
export async function sendOpsAlert(alert: OpsAlert, deps: AlertDeps = {}): Promise<boolean> {
  const webhookUrl = deps.webhookUrl ?? config.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return false;
  }

  const now = deps.now ?? Date.now;
  const key = alert.dedupeKey ?? alert.title;
  const previous = lastSentAt.get(key);
  const ts = now();
  if (previous !== undefined && ts - previous < DEDUPE_WINDOW_MS) {
    logger.warn({ key }, "ops alert suppressed (dedupe window)");
    return false;
  }

  const fetchImpl: AlertFetch =
    deps.fetch ??
    (async (url, init) => {
      const response = await fetch(url, init);
      return { ok: response.ok, status: response.status };
    });

  const payload = buildAlertBody(alert, webhookUrl);
  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "content-type": payload.contentType },
      body: payload.body,
    });
    if (!response.ok) {
      logger.error(
        { status: response.status, title: alert.title },
        "ops alert webhook returned non-2xx",
      );
      return false;
    }
    lastSentAt.set(key, ts);
    logger.warn({ title: alert.title, severity: alert.severity ?? "error" }, "ops alert sent");
    return true;
  } catch (error) {
    logger.error({ err: error, title: alert.title }, "ops alert webhook failed");
    return false;
  }
}

export function enqueueOpsAlert(alert: OpsAlert, deps: AlertDeps = {}): void {
  void sendOpsAlert(alert, deps).catch((error) => {
    logger.error({ err: error }, "ops alert crashed");
  });
}
