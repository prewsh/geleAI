type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

function now() {
  return Date.now();
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const currentTime = now();
  const existing = store.get(options.key);

  if (!existing || existing.resetAt <= currentTime) {
    const resetAt = currentTime + options.windowMs;
    store.set(options.key, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt,
      retryAfterSeconds: 0
    };
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000));

    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds
    };
  }

  existing.count += 1;
  store.set(options.key, existing);

  return {
    allowed: true,
    remaining: options.limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: 0
  };
}

export function getRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown-ip";
}

export function __resetRateLimitStoreForTests() {
  store.clear();
}
