import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env";

describe("loadConfig", () => {
  it("fails fast with a list of missing variables", () => {
    expect(() => loadConfig({ NODE_ENV: "sandbox" })).toThrow(
      /Invalid environment configuration[\s\S]*DATABASE_URL is missing/,
    );
  });
});
