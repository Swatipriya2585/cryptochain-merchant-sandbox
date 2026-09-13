import { afterEach, describe, expect, it } from "vitest";
import {
  buildAlertBody,
  detectAlertTarget,
  resetAlertDedupeForTests,
  sendOpsAlert,
} from "../src/lib/alerts";

describe("ops alerts", () => {
  afterEach(() => {
    resetAlertDedupeForTests();
  });

  it("detects Slack vs Discord webhook URLs", () => {
    expect(detectAlertTarget("https://hooks.slack.com/services/T/B/XXX")).toBe("slack");
    expect(detectAlertTarget("https://discord.com/api/webhooks/1/abc")).toBe("discord");
    expect(detectAlertTarget("https://example.com/hooks")).toBe("generic");
  });

  it("sends Slack-shaped JSON to Slack and Discord-shaped JSON to Discord", async () => {
    const slackBodies: string[] = [];
    await sendOpsAlert(
      { title: "Merchant webhook delivery exhausted retries", body: "event 1 failed" },
      {
        webhookUrl: "https://hooks.slack.com/services/T/B/XXX",
        fetch: async (_url, init) => {
          slackBodies.push(init.body);
          return { ok: true, status: 200 };
        },
      },
    );
    expect(JSON.parse(slackBodies[0] ?? "{}")).toMatchObject({
      text: expect.stringContaining("webhook delivery exhausted"),
    });
    expect(JSON.parse(slackBodies[0] ?? "{}")).not.toHaveProperty("content");

    resetAlertDedupeForTests();
    const discordBodies: string[] = [];
    await sendOpsAlert(
      { title: "Payout FAILED", body: "payout x failed" },
      {
        webhookUrl: "https://discord.com/api/webhooks/1/abc",
        fetch: async (_url, init) => {
          discordBodies.push(init.body);
          return { ok: true, status: 200 };
        },
      },
    );
    expect(JSON.parse(discordBodies[0] ?? "{}")).toMatchObject({
      content: expect.stringContaining("Payout FAILED"),
    });
  });

  it("dedupes repeated alerts within the window", async () => {
    let calls = 0;
    const deps = {
      webhookUrl: "https://hooks.slack.com/services/T/B/XXX",
      fetch: async () => {
        calls += 1;
        return { ok: true, status: 200 };
      },
    };
    await sendOpsAlert({ title: "same", body: "a", dedupeKey: "k" }, deps);
    await sendOpsAlert({ title: "same", body: "b", dedupeKey: "k" }, deps);
    expect(calls).toBe(1);
  });

  it("buildAlertBody includes mode and chain", () => {
    const payload = buildAlertBody({ title: "t", body: "b" });
    expect(payload.body).toMatch(/mode=sandbox/);
    expect(payload.body).toMatch(/chain=Sepolia/);
  });
});
