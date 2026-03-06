import { ALLOWED_IMAGE_TYPES, AllowedImageMimeType, GELE_COLORS, GeleColor, TransformInput } from "./types";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_STYLE_PROMPT_LENGTH = 240;
const MAX_TZ_LENGTH = 100;

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

  return prompt.replace(/[<>]/g, "");
}

function normalizeClientTimeZone(raw: FormDataEntryValue | null): string {
  const fallback = "Africa/Lagos";

  if (!raw || typeof raw !== "string") return fallback;

  const timeZone = raw.trim();
  if (!timeZone || timeZone.length > MAX_TZ_LENGTH) return fallback;

  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return fallback;
  }
}

function matchesFileSignature(bytes: Uint8Array, mimeType: AllowedImageMimeType) {
  if (mimeType === "image/png") {
    return (
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mimeType === "image/jpeg") {
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/webp") {
    return (
      bytes.length > 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }

  return false;
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
  const clientTimeZone = normalizeClientTimeZone(formData.get("clientTimeZone"));

  const blob = file as unknown as Blob;
  const arrayBuffer =
    typeof blob.arrayBuffer === "function" ? await blob.arrayBuffer() : await new Response(file as unknown as Blob).arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!matchesFileSignature(bytes, imageMimeType)) {
    throw new ValidationError("Invalid image file signature.", "INVALID_IMAGE_SIGNATURE");
  }

  const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    imageBase64,
    imageMimeType,
    stylePrompt,
    geleColor,
    clientTimeZone
  };
}
