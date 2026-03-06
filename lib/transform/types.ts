export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const GELE_COLORS = ["auto", "red", "blue", "gold", "green"] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_TYPES)[number];
export type GeleColor = (typeof GELE_COLORS)[number];

export type TransformInput = {
  imageBase64: string;
  imageMimeType: AllowedImageMimeType;
  stylePrompt: string;
  geleColor: GeleColor;
  clientTimeZone: string;
};

export type TransformResponsePayload = {
  jobId: string;
  status: "completed";
  outputImageUrl: string;
  meta: {
    provider: "gemini";
    durationMs: number;
    model: string;
  };
};
