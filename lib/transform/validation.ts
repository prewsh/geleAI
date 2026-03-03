import { ALLOWED_IMAGE_TYPES, AllowedImageMimeType, GELE_COLORS, GeleColor, TransformInput } from "./types";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_STYLE_PROMPT_LENGTH = 240;

export class ValidationError extends Error {
  readonly code: string;

  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

function toAllowedMimeType(value: string): AllowedImageMimeType {
  if (ALLOWED_IMAGE_TYPES.includes(value as AllowedImageMimeType)) {
    return value as AllowedImageMimeType;
  }

  throw new ValidationError("Please upload JPG, PNG, or WebP only.", "UNSUPPORTED_IMAGE_TYPE");
}

function toGeleColor(rawColor: FormDataEntryValue | null): GeleColor {
  const fallback: GeleColor = "auto";

  if (!rawColor || typeof rawColor !== "string") return fallback;

  const normalized = rawColor.trim().toLowerCase();
  if (GELE_COLORS.includes(normalized as GeleColor)) {
    return normalized as GeleColor;
  }

  return fallback;
}

function normalizeStylePrompt(raw: FormDataEntryValue | null): string {
  if (!raw || typeof raw !== "string") {
    return "Classic Nigerian gele, wedding-ready elegance";
  }

  const prompt = raw.trim();
  if (!prompt) return "Classic Nigerian gele, wedding-ready elegance";

  if (prompt.length > MAX_STYLE_PROMPT_LENGTH) {
    throw new ValidationError("Style prompt is too long. Keep it under 240 characters.", "PROMPT_TOO_LONG");
  }

  return prompt;
}

export async function parseTransformFormData(formData: FormData): Promise<TransformInput> {
  const imageEntry = formData.get("image");
  if (!imageEntry || !(imageEntry instanceof File)) {
    throw new ValidationError("Please attach an image file.", "MISSING_IMAGE");
  }

  const file = imageEntry;
  if (file.size <= 0) {
    throw new ValidationError("Uploaded image is empty.", "EMPTY_IMAGE");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("Image must be 10MB or smaller.", "IMAGE_TOO_LARGE");
  }

  const imageMimeType = toAllowedMimeType(file.type);
  const stylePrompt = normalizeStylePrompt(formData.get("stylePrompt"));
  const geleColor = toGeleColor(formData.get("geleColor"));

  const arrayBuffer =
    typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : await new Response(file as unknown as Blob).arrayBuffer();
  const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    imageBase64,
    imageMimeType,
    stylePrompt,
    geleColor
  };
}
