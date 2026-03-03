import { GeminiTransformProvider, getDefaultGeminiModel } from "./gemini-adapter";
import { ProviderError, TransformProvider } from "./types";

export function resolveTransformProvider(): TransformProvider {
  const provider = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();

  if (provider !== "gemini") {
    throw new ProviderError(`Unsupported AI provider: ${provider}`, 500, "UNSUPPORTED_PROVIDER");
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new ProviderError(
      "GEMINI_API_KEY is missing. Add it to .env.local or deployment env vars, then restart the server.",
      500,
      "MISSING_GEMINI_API_KEY"
    );
  }

  return new GeminiTransformProvider(apiKey, getDefaultGeminiModel());
}
