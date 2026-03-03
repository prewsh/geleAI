import { buildGelePrompt } from "../transform/prompt";
import { TransformInput } from "../transform/types";
import { ProviderError, ProviderOutput, TransformProvider } from "./types";

type GeminiPart = {
  text?: string;
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
  inline_data?: {
    data?: string;
    mime_type?: string;
  };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    code?: number;
    message?: string;
  };
};

const DEFAULT_MODEL = "gemini-2.5-flash-image";
const DEFAULT_TIMEOUT_MS = 35_000;

function extractImagePart(payload: GeminiResponse): { data: string; mimeType: string } | null {
  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];

  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png"
      };
    }

    if (part.inline_data?.data) {
      return {
        data: part.inline_data.data,
        mimeType: part.inline_data.mime_type ?? "image/png"
      };
    }
  }

  return null;
}

export class GeminiTransformProvider implements TransformProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, model = DEFAULT_MODEL, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async transformPortrait(input: TransformInput): Promise<ProviderOutput> {
    const prompt = buildGelePrompt(input.stylePrompt, input.geleColor);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: input.imageMimeType,
                    data: input.imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        })
      });
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderError("Image generation timed out. Please try again.", 504, "PROVIDER_TIMEOUT");
      }

      throw new ProviderError("Network error while contacting Gemini.", 502, "TRANSIENT_PROVIDER_FAILURE");
    }

    clearTimeout(timeout);

    let payload: GeminiResponse | null = null;

    try {
      payload = (await response.json()) as GeminiResponse;
    } catch {
      throw new ProviderError("Gemini returned an unreadable response.", 502, "BAD_PROVIDER_RESPONSE");
    }

    if (!response.ok) {
      const providerMessage = payload?.error?.message ?? "Image generation failed at provider.";
      if (response.status === 429) {
        throw new ProviderError(providerMessage, 429, "QUOTA_EXCEEDED");
      }

      if (response.status >= 500) {
        throw new ProviderError(providerMessage, 502, "TRANSIENT_PROVIDER_FAILURE");
      }

      throw new ProviderError(providerMessage, 502, "PROVIDER_FAILURE");
    }

    const imagePart = extractImagePart(payload);

    if (!imagePart?.data) {
      throw new ProviderError("Gemini did not return an image output.", 502, "NO_IMAGE_OUTPUT");
    }

    return {
      imageBase64: imagePart.data,
      mimeType: imagePart.mimeType,
      model: this.model
    };
  }
}

export function getDefaultGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}
