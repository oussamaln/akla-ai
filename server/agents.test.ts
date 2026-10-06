import { describe, expect, it } from "vitest";
import { normalizeAgentConfig } from "./agents";

describe("agent configuration safety", () => {
  it("preserves creator context while always appending platform rules", () => {
    const config = normalizeAgentConfig({
      name: "Treasury Guide",
      description: "Explains the project treasury and token mechanics.",
      personality: "Analytical",
      systemInstructions: "Use concise language.",
      goals: "Help the community learn.",
      allowedActions: "Explain public project documents.",
      prohibitedActions: "Never ask for a seed phrase.",
      responseStyle: "Structured",
    });

    expect(config.name).toBe("Treasury Guide");
    expect(config.prohibitedActions).toContain("Never ask for a seed phrase.");
    expect(config.prohibitedActions).toContain("Never request private keys");
    expect(config.prohibitedActions).toContain(
      "Never claim a blockchain transaction"
    );
  });

  it("strips control characters and bounds creator-authored fields", () => {
    const config = normalizeAgentConfig({
      name: "  Agent\u0000  ",
      description: "A useful description",
      personality: "Friendly",
      systemInstructions: "\u0001safe",
      goals: "goals",
      allowedActions: "actions",
      prohibitedActions: "rules",
      responseStyle: "Clear",
    });

    expect(config.name).toBe("Agent");
    expect(config.systemInstructions).toBe("safe");
    expect(config.prohibitedActions.startsWith("rules")).toBe(true);
  });
});
