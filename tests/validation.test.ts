import { describe, expect, it } from "vitest";
import { parseTransformFormData, ValidationError } from "../lib/transform/validation";

describe("parseTransformFormData", () => {
  it("parses valid form data", async () => {
    const validPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const form = new FormData();
    const validFile = new File([validPngHeader], "portrait.png", { type: "image/png" });
    Object.defineProperty(validFile, "arrayBuffer", {
      value: async () => validPngHeader.buffer,
      configurable: true
    });
    form.set("image", validFile);
    form.set("stylePrompt", "Structured wedding gele");
    form.set("geleColor", "red");
    form.set("clientTimeZone", "Africa/Lagos");

    const parsed = await parseTransformFormData(form);

    expect(parsed.imageMimeType).toBe("image/png");
    expect(parsed.stylePrompt).toBe("Structured wedding gele");
    expect(parsed.geleColor).toBe("red");
    expect(parsed.clientTimeZone).toBe("Africa/Lagos");
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

  it("rejects wrong file signature for declared type", async () => {
    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3, 4, 5])], "portrait.png", { type: "image/png" }));

    await expect(parseTransformFormData(form)).rejects.toMatchObject({ code: "INVALID_IMAGE_SIGNATURE" });
  });
});
