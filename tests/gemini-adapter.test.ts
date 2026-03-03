/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiTransformProvider } from "../lib/ai/gemini-adapter";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("GeminiTransformProvider", () => {
  it("parses image output from provider response", async () => {
    const provider = new GeminiTransformProvider("test-key", "gemini-test");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: "YWJj",
                    mimeType: "image/png"
                  }
                }
              ]
            }
          }
        ]
      })
    }) as unknown as typeof fetch;

    const output = await provider.transformPortrait({
      imageBase64: "base64",
      imageMimeType: "image/png",
      stylePrompt: "Classic style",
      geleColor: "auto"
    });

    expect(output.imageBase64).toBe("YWJj");
    expect(output.mimeType).toBe("image/png");
    expect(output.model).toBe("gemini-test");
  });

  it("throws quota error when provider returns 429", async () => {
    const provider = new GeminiTransformProvider("test-key", "gemini-test");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: "Quota exceeded"
        }
      })
    }) as unknown as typeof fetch;

    await expect(
      provider.transformPortrait({
        imageBase64: "base64",
        imageMimeType: "image/png",
        stylePrompt: "Classic style",
        geleColor: "auto"
      })
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", statusCode: 429 });
  });

  it("throws timeout error when provider request aborts", async () => {
    const provider = new GeminiTransformProvider("test-key", "gemini-test", 1);

    global.fetch = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")) as unknown as typeof fetch;

    await expect(
      provider.transformPortrait({
        imageBase64: "base64",
        imageMimeType: "image/png",
        stylePrompt: "Classic style",
        geleColor: "auto"
      })
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", statusCode: 504 });
  });
});
