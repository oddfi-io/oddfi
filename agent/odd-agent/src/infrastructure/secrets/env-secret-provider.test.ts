import { describe, expect, it } from "vitest";
import { EnvSecretProvider } from "./env-secret-provider.js";

describe("EnvSecretProvider", () => {
  it("prefers ignored local config secrets before environment variables", async () => {
    const previous = process.env["ODD_AGENT_TEST_SECRET"];
    process.env["ODD_AGENT_TEST_SECRET"] = "env-value";
    try {
      const provider = new EnvSecretProvider({
        ODD_AGENT_TEST_SECRET: "local-value"
      });

      await expect(provider.getSecret("ODD_AGENT_TEST_SECRET")).resolves.toBe("local-value");
    } finally {
      if (previous === undefined) {
        delete process.env["ODD_AGENT_TEST_SECRET"];
      } else {
        process.env["ODD_AGENT_TEST_SECRET"] = previous;
      }
    }
  });
});
