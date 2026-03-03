/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "../lib/ai/types";
import { __resetRateLimitStoreForTests } from "../lib/server/rate-limit";

const { mockTransform, mockResolveProvider } = vi.hoisted(() => {
  return {
    mockTransform: vi.fn(),
    mockResolveProvider: vi.fn()
  };
});

vi.mock("../lib/ai/provider", () => ({
  resolveTransformProvider: mockResolveProvider
}));

import { POST } from "../app/api/transform/route";

describe("POST /api/transform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimitStoreForTests();

    mockResolveProvider.mockReturnValue({
      transformPortrait: mockTransform
    });
  });

  it("returns transformed image payload on success", async () => {
    mockTransform.mockResolvedValue({
      imageBase64: "ZmFrZS1pbWFnZQ==",
      mimeType: "image/png",
      model: "gemini-test-model"
    });

    const formData = new FormData();
    formData.set("image", new File([new Uint8Array([1, 2, 3])], "portrait.png", { type: "image/png" }));
    formData.set("stylePrompt", "Bold wedding gele");
    formData.set("geleColor", "blue");

    const request = new Request("http://localhost/api/transform", {
      method: "POST",
      body: formData,
      headers: {
        "x-forwarded-for": "10.0.0.2"
      }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("completed");
    expect(payload.outputImageUrl).toContain("data:image/png;base64,ZmFrZS1pbWFnZQ==");
    expect(payload.meta.provider).toBe("gemini");
    expect(payload.meta.model).toBe("gemini-test-model");
  });

  it("returns 400 for missing image", async () => {
    const request = new Request("http://localhost/api/transform", {
      method: "POST",
      body: new FormData(),
      headers: {
        "x-forwarded-for": "10.0.0.3"
      }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe("MISSING_IMAGE");
    expect(mockResolveProvider).not.toHaveBeenCalled();
  });

  it("retries once on transient provider failure", async () => {
    mockTransform
      .mockRejectedValueOnce(new ProviderError("Temporary provider outage", 502, "TRANSIENT_PROVIDER_FAILURE"))
      .mockResolvedValueOnce({
        imageBase64: "ZmFrZS1pbWFnZQ==",
        mimeType: "image/png",
        model: "gemini-test-model"
      });

    const formData = new FormData();
    formData.set("image", new File([new Uint8Array([1, 2, 3])], "portrait.png", { type: "image/png" }));

    const request = new Request("http://localhost/api/transform", {
      method: "POST",
      body: formData,
      headers: {
        "x-forwarded-for": "10.0.0.4"
      }
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockTransform).toHaveBeenCalledTimes(2);
  });

  it("returns 429 when the same IP exceeds rate limit", async () => {
    mockTransform.mockResolvedValue({
      imageBase64: "ZmFrZS1pbWFnZQ==",
      mimeType: "image/png",
      model: "gemini-test-model"
    });

    const ip = "10.0.0.5";

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const formData = new FormData();
      formData.set("image", new File([new Uint8Array([1, 2, 3])], "portrait.png", { type: "image/png" }));

      const request = new Request("http://localhost/api/transform", {
        method: "POST",
        body: formData,
        headers: {
          "x-forwarded-for": ip
        }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    }

    const blockedForm = new FormData();
    blockedForm.set("image", new File([new Uint8Array([1, 2, 3])], "portrait.png", { type: "image/png" }));
    const blockedRequest = new Request("http://localhost/api/transform", {
      method: "POST",
      body: blockedForm,
      headers: {
        "x-forwarded-for": ip
      }
    });

    const blockedResponse = await POST(blockedRequest);
    const blockedPayload = await blockedResponse.json();

    expect(blockedResponse.status).toBe(429);
    expect(blockedPayload.code).toBe("RATE_LIMITED");
    expect(Number(blockedResponse.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
