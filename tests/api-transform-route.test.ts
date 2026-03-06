/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "../lib/ai/types";
import { __resetRateLimitStoreForTests } from "../lib/server/rate-limit";

const validPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

const { mockTransform, mockResolveProvider, mockGetUser, mockGetUsageToday, mockStoreGeneration, mockPurgeExpired } = vi.hoisted(() => {
  return {
    mockTransform: vi.fn(),
    mockResolveProvider: vi.fn(),
    mockGetUser: vi.fn(),
    mockGetUsageToday: vi.fn(),
    mockStoreGeneration: vi.fn(),
    mockPurgeExpired: vi.fn()
  };
});

vi.mock("../lib/ai/provider", () => ({
  resolveTransformProvider: mockResolveProvider
}));

vi.mock("../lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser
    }
  })
}));

vi.mock("../lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue({})
}));

vi.mock("../lib/generations/service", () => ({
  purgeExpiredGenerations: mockPurgeExpired,
  getUserFreeGenerationsToday: mockGetUsageToday,
  storeGenerationAndCreateSignedUrl: mockStoreGeneration,
  listActiveUserGenerations: vi.fn()
}));

import { POST } from "../app/api/transform/route";

describe("POST /api/transform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimitStoreForTests();

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "test@example.com" } } });
    mockGetUsageToday.mockResolvedValue({ usageDay: "2026-03-05", count: 0, retryAfterSeconds: 3600 });
    mockPurgeExpired.mockResolvedValue(undefined);

    mockResolveProvider.mockReturnValue({
      transformPortrait: mockTransform
    });

    mockStoreGeneration.mockResolvedValue({
      generationId: "gen-1",
      signedUrl: "https://example.com/signed.png",
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString()
    });
  });

  it("returns transformed image payload on success", async () => {
    mockTransform.mockResolvedValue({
      imageBase64: "ZmFrZS1pbWFnZQ==",
      mimeType: "image/png",
      model: "gemini-test-model"
    });

    const formData = new FormData();
    formData.set("image", new File([validPngHeader], "portrait.png", { type: "image/png" }));
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
    expect(payload.outputImageUrl).toContain("https://example.com/signed.png");
    expect(payload.meta.provider).toBe("gemini");
    expect(payload.meta.model).toBe("gemini-test-model");
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const formData = new FormData();
    formData.set("image", new File([validPngHeader], "portrait.png", { type: "image/png" }));

    const request = new Request("http://localhost/api/transform", {
      method: "POST",
      body: formData,
      headers: {
        "x-forwarded-for": "10.0.0.3"
      }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.code).toBe("UNAUTHENTICATED");
    expect(mockResolveProvider).not.toHaveBeenCalled();
  });

  it("returns 429 when free daily limit is already used", async () => {
    mockGetUsageToday.mockResolvedValue({ usageDay: "2026-03-05", count: 3, retryAfterSeconds: 10800 });

    const formData = new FormData();
    formData.set("image", new File([validPngHeader], "portrait.png", { type: "image/png" }));

    const request = new Request("http://localhost/api/transform", {
      method: "POST",
      body: formData,
      headers: {
        "x-forwarded-for": "10.0.0.4"
      }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.code).toBe("FREE_DAILY_LIMIT_REACHED");
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
    formData.set("image", new File([validPngHeader], "portrait.png", { type: "image/png" }));

    const request = new Request("http://localhost/api/transform", {
      method: "POST",
      body: formData,
      headers: {
        "x-forwarded-for": "10.0.0.5"
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

    const ip = "10.0.0.6";

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const formData = new FormData();
      formData.set("image", new File([validPngHeader], "portrait.png", { type: "image/png" }));

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
    blockedForm.set("image", new File([validPngHeader], "portrait.png", { type: "image/png" }));
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
