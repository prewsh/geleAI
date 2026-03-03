import { describe, expect, it } from "vitest";
import { parseTransformFormData, ValidationError } from "../lib/transform/validation";

describe("parseTransformFormData", () => {
  it("parses valid form data", async () => {
    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "portrait.png", { type: "image/png" }));
    form.set("stylePrompt", "Structured wedding gele");
    form.set("geleColor", "red");

    const parsed = await parseTransformFormData(form);

    expect(parsed.imageMimeType).toBe("image/png");
    expect(parsed.stylePrompt).toBe("Structured wedding gele");
    expect(parsed.geleColor).toBe("red");
    expect(parsed.imageBase64.length).toBeGreaterThan(0);
  });

  it("throws on invalid mime type", async () => {
    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "portrait.gif", { type: "image/gif" }));

    await expect(parseTransformFormData(form)).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when image is missing", async () => {
    await expect(parseTransformFormData(new FormData())).rejects.toBeInstanceOf(ValidationError);
  });
});
