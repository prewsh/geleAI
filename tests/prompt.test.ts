import { describe, expect, it } from "vitest";
import { buildGelePrompt } from "../lib/transform/prompt";

describe("buildGelePrompt", () => {
  it("injects color-specific direction", () => {
    const prompt = buildGelePrompt("Soft bridal gele", "gold");

    expect(prompt).toContain("elegant gold gele fabric");
    expect(prompt).toContain("Style direction: Soft bridal gele");
  });

  it("falls back to default style text when prompt is empty", () => {
    const prompt = buildGelePrompt("   ", "auto");

    expect(prompt).toContain("Classic Nigerian gele");
    expect(prompt).toContain("Preserve identity");
  });
});
