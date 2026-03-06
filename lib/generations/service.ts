import { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getGenerationsBucket } from "../supabase/config";

const RETENTION_DAYS = 7;
const FALLBACK_TIMEZONE = "Africa/Lagos";

type GenerationRow = {
  id: string;
  user_id: string;
  prompt: string | null;
  gele_color: string | null;
  storage_path: string;
  created_at: string;
  expires_at: string;
};

function safeTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

function dateStringInTimeZone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function secondsUntilNextMidnight(timeZone: string) {
  const tz = safeTimeZone(timeZone);
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  const hour = Number(parts.hour ?? "0");
  const minute = Number(parts.minute ?? "0");
  const second = Number(parts.second ?? "0");

  const elapsed = hour * 3600 + minute * 60 + second;
  return Math.max(1, 24 * 3600 - elapsed);
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function addDays(date: Date, days: number) {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

export async function purgeExpiredGenerations(supabaseAdmin: SupabaseClient, userId: string) {
  const { data: expiredRows, error: queryError } = await supabaseAdmin
    .from("generations")
    .select("id, storage_path")
    .eq("user_id", userId)
    .lte("expires_at", new Date().toISOString())
    .limit(200);

  if (queryError || !expiredRows || expiredRows.length === 0) {
    return;
  }

  const paths = expiredRows
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path));

  if (paths.length > 0) {
    await supabaseAdmin.storage.from(getGenerationsBucket()).remove(paths);
  }

  const ids = expiredRows.map((row) => row.id);
  await supabaseAdmin.from("generations").delete().in("id", ids);
}

export async function getUserFreeGenerationsToday(supabaseAdmin: SupabaseClient, userId: string, timeZone: string) {
  const usageDay = dateStringInTimeZone(timeZone);

  const { count, error } = await supabaseAdmin
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("usage_day", usageDay)
    .eq("is_free", true);

  if (error) {
    throw new Error(`Failed checking daily generation limit: ${error.message}`);
  }

  return {
    usageDay,
    count: count ?? 0,
    retryAfterSeconds: secondsUntilNextMidnight(timeZone)
  };
}

type StoreGenerationInput = {
  userId: string;
  prompt: string;
  geleColor: string;
  base64Image: string;
  mimeType: string;
  model: string;
  durationMs: number;
  usageDay: string;
};

export async function storeGenerationAndCreateSignedUrl(supabaseAdmin: SupabaseClient, input: StoreGenerationInput) {
  const bucket = getGenerationsBucket();
  const ext = extensionForMime(input.mimeType);
  const objectName = `${input.userId}/${randomUUID()}.${ext}`;
  const binary = Buffer.from(input.base64Image, "base64");

  const upload = await supabaseAdmin.storage.from(bucket).upload(objectName, binary, {
    contentType: input.mimeType,
    upsert: false
  });

  if (upload.error) {
    throw new Error(`Failed to store generated image: ${upload.error.message}`);
  }

  const expiresAt = addDays(new Date(), RETENTION_DAYS).toISOString();

  const insert = await supabaseAdmin
    .from("generations")
    .insert({
      user_id: input.userId,
      prompt: input.prompt,
      gele_color: input.geleColor,
      storage_path: objectName,
      model: input.model,
      duration_ms: input.durationMs,
      is_free: true,
      usage_day: input.usageDay,
      expires_at: expiresAt
    })
    .select("id, created_at, expires_at")
    .single();

  if (insert.error) {
    await supabaseAdmin.storage.from(bucket).remove([objectName]);
    throw new Error(`Failed to save generation record: ${insert.error.message}`);
  }

  const signed = await supabaseAdmin.storage.from(bucket).createSignedUrl(objectName, 60 * 60);

  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${signed.error?.message || "Unknown error"}`);
  }

  return {
    signedUrl: signed.data.signedUrl,
    generationId: insert.data.id,
    createdAt: insert.data.created_at,
    expiresAt: insert.data.expires_at
  };
}

export async function listActiveUserGenerations(supabaseAdmin: SupabaseClient, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, prompt, gele_color, storage_path, created_at, expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to load generated images: ${error.message}`);
  }

  const rows = (data ?? []) as GenerationRow[];

  const signedRows = await Promise.all(
    rows.map(async (row) => {
      const signed = await supabaseAdmin.storage.from(getGenerationsBucket()).createSignedUrl(row.storage_path, 60 * 60);

      if (signed.error || !signed.data?.signedUrl) {
        return null;
      }

      return {
        id: row.id,
        prompt: row.prompt,
        geleColor: row.gele_color,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        imageUrl: signed.data.signedUrl
      };
    })
  );

  return signedRows.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function getGenerationStoragePathForUser(supabaseAdmin: SupabaseClient, userId: string, generationId: string) {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("storage_path, expires_at")
    .eq("id", generationId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return data.storage_path as string;
}
