"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

type Screen = "upload" | "processing" | "result";
type Stage = "Uploading image" | "Analyzing head position" | "Applying gele style" | "Finalizing image";
type GeleColor = "auto" | "red" | "blue" | "gold" | "green";
type AuthMode = "login" | "signup";

type TransformApiResponse = {
  jobId: string;
  status: "completed";
  outputImageUrl: string;
  meta: {
    provider: "gemini";
    durationMs: number;
    model: string;
  };
};

type TransformApiError = {
  status?: string;
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
  requestId?: string;
};

class TransformRequestError extends Error {
  readonly code?: string;
  readonly retryAfterSeconds?: number;
  readonly requestId?: string;

  constructor(message: string, payload?: TransformApiError) {
    super(message);
    this.name = "TransformRequestError";
    this.code = payload?.code;
    this.retryAfterSeconds = payload?.retryAfterSeconds;
    this.requestId = payload?.requestId;
  }
}

const STAGES: Stage[] = [
  "Uploading image",
  "Analyzing head position",
  "Applying gele style",
  "Finalizing image"
];

function slugifyStyle(input: string) {
  return input.trim() || "Classic gele";
}

function firstNameAsUsername(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] || "user";
  const cleaned = first.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return cleaned || "user";
}

function formatResetCountdown(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }

  return `${Math.max(1, mins)}m`;
}

async function transformPortrait(file: File, stylePrompt: string, geleColor: GeleColor): Promise<TransformApiResponse> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("stylePrompt", stylePrompt);
  formData.append("geleColor", geleColor);
  formData.append("clientTimeZone", Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos");

  const response = await fetch("/api/transform", {
    method: "POST",
    body: formData
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorPayload = payload as TransformApiError;
    throw new TransformRequestError(errorPayload.message || "Unable to transform image at the moment.", errorPayload);
  }

  return payload as TransformApiResponse;
}

export default function HomePage() {
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const [screen, setScreen] = useState<Screen>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [sourceImage, setSourceImage] = useState<string>("");
  const [resultImage, setResultImage] = useState<string>("");
  const [currentStage, setCurrentStage] = useState<Stage>(STAGES[0]);
  const [stylePrompt, setStylePrompt] = useState("Classic gele, wedding-ready elegance");
  const [geleColor, setGeleColor] = useState<GeleColor>("auto");
  const [error, setError] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authCountry, setAuthCountry] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [remainingGenerations, setRemainingGenerations] = useState(3);
  const [runAfterAuth, setRunAfterAuth] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refreshUsage() {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
      const response = await fetch(`/api/account/usage?tz=${encodeURIComponent(timeZone)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: { remaining?: number } };
      setRemainingGenerations(payload.data?.remaining ?? 3);
    } catch {
      // keep previous value if usage lookup fails
    }
  }

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      const loggedIn = Boolean(data.user);
      setIsLoggedIn(loggedIn);
      if (loggedIn) {
        void refreshUsage();
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = Boolean(session?.user);
      setIsLoggedIn(loggedIn);
      if (loggedIn) {
        void refreshUsage();
      } else {
        setRemainingGenerations(3);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (sourceImage.startsWith("blob:")) {
        URL.revokeObjectURL(sourceImage);
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sourceImage, supabase]);

  const stageIndex = useMemo(() => STAGES.indexOf(currentStage), [currentStage]);

  async function runTransformFlow() {
    if (!selectedFile || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError("");
      setErrorDetails("");
      setScreen("processing");
      setCurrentStage(STAGES[0]);

      let index = 0;
      intervalRef.current = setInterval(() => {
        index += 1;
        if (index < STAGES.length - 1) {
          setCurrentStage(STAGES[index]);
        }
      }, 1200);

      const transformed = await transformPortrait(selectedFile, stylePrompt, geleColor);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      setCurrentStage(STAGES[3]);
      setResultImage(transformed.outputImageUrl);
      await refreshUsage();
      setScreen("result");
    } catch (transformError) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (transformError instanceof TransformRequestError) {
        if (transformError.code === "UNAUTHENTICATED") {
          setAuthOpen(true);
          setRunAfterAuth(true);
          setError("Please login or create an account to generate your image.");
          setScreen("upload");
        } else {
          const isFreeLimitReached = transformError.code === "FREE_DAILY_LIMIT_REACHED";
          const resetText =
            isFreeLimitReached && transformError.retryAfterSeconds
              ? `{reset in ${formatResetCountdown(transformError.retryAfterSeconds)}}`
              : "";
          const friendlyMessage = isFreeLimitReached
            ? `You've used your 3 free generations for today. ${resetText}`.trim()
            : transformError.message || "Unable to transform image right now.";
          setError(friendlyMessage);
          setErrorDetails(transformError.requestId ? `Request ID: ${transformError.requestId}` : "");
          setScreen("upload");
        }
      } else {
        setError(transformError instanceof Error ? transformError.message : "Unexpected transform failure.");
        setErrorDetails("");
        setScreen("upload");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onTransformClick() {
    if (!supabase) {
      setError("Authentication is not configured. Add Supabase env vars and reload.");
      return;
    }

    if (!isLoggedIn) {
      setAuthOpen(true);
      setAuthMode("login");
      setRunAfterAuth(true);
      return;
    }

    await runTransformFlow();
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setRemainingGenerations(3);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");

    if (!supabase) {
      setAuthLoading(false);
      setAuthError("Supabase is not configured.");
      return;
    }

    try {
      if (authMode === "signup") {
        if (!authFullName.trim() || !authCountry.trim()) {
          setAuthError("Full name and country are required for signup.");
          return;
        }

        const passwordHasUpper = /[A-Z]/.test(authPassword);
        const passwordHasNumber = /[0-9]/.test(authPassword);
        const passwordLongEnough = authPassword.length >= 8;

        if (!passwordHasUpper || !passwordHasNumber || !passwordLongEnough) {
          setAuthError("Password must be at least 8 characters and include an uppercase letter and a number.");
          return;
        }

        const username = firstNameAsUsername(authFullName);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              full_name: authFullName.trim(),
              country: authCountry.trim(),
              username
            }
          }
        });

        if (signUpError) {
          setAuthError(signUpError.message);
          return;
        }

        if (!data.session) {
          setAuthMessage("Signup successful. Please verify your email, then login.");
          setAuthMode("login");
          return;
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });

        if (loginError) {
          setAuthError(loginError.message);
          return;
        }
      }

      setAuthOpen(false);
      setIsLoggedIn(true);
      await refreshUsage();

      if (runAfterAuth && selectedFile) {
        setRunAfterAuth(false);
        await runTransformFlow();
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }

    if (!authEmail.trim()) {
      setAuthError("Enter your email first, then click forgot password.");
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });

    if (resetError) {
      setAuthError(resetError.message);
      return;
    }

    setAuthError("");
    setAuthMessage("Password reset email sent. Check your inbox.");
  }

  function handleImageInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload JPG, PNG, or WebP only.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be 10MB or smaller.");
      return;
    }

    setError("");
    setErrorDetails("");
    setFileName(file.name);
    setSelectedFile(file);

    if (sourceImage.startsWith("blob:")) {
      URL.revokeObjectURL(sourceImage);
    }

    setSourceImage(URL.createObjectURL(file));
    setResultImage("");
  }

  function resetFlow() {
    setScreen("upload");
    setResultImage("");
    setError("");
    setErrorDetails("");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-8 md:px-8">
      <div className="rounded-3xl border border-orange-100 bg-[var(--bg-panel)]/90 p-6 shadow-[0_24px_80px_rgba(190,95,35,0.14)] backdrop-blur md:p-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">Gele AI</p>
            <h1 className="text-3xl leading-tight md:text-5xl">Add gele to your portrait picture in 3 seconds.</h1>
            <p className="mt-3 max-w-2xl text-sm text-[var(--muted)] md:text-base">
              {isLoggedIn
                ? `you have ${remainingGenerations} generation${remainingGenerations === 1 ? "" : "s"} remaining`
                : "Sign in to tie gele. Each account gets 3 free generation per day."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="rounded-xl border border-orange-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-orange-50">
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-xl border border-orange-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-orange-50"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
                className="rounded-xl border border-orange-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-orange-50"
              >
                Login / Signup
              </button>
            )}
          </div>
        </div>

        {screen === "upload" && (
          <section className="grid gap-5 md:grid-cols-5">
            <div className="md:col-span-3">
              <label
                htmlFor="portraitUpload"
                className="group flex min-h-52 cursor-pointer flex-col justify-center rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/45 p-6 transition hover:border-[var(--brand)] hover:bg-orange-100/60"
              >
                <span className="text-lg font-semibold">Upload portrait image</span>
                <span className="mt-2 text-sm text-[var(--muted)]">JPG, PNG, WebP up to 10MB.</span>
                {fileName ? <span className="mt-4 text-sm font-medium text-[var(--brand-strong)]">{fileName}</span> : null}
              </label>
              <input id="portraitUpload" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleImageInput} />
            </div>

            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--muted)]" htmlFor="stylePrompt">
                  Style prompt
                </label>
                <textarea
                  id="stylePrompt"
                  value={stylePrompt}
                  onChange={(event) => setStylePrompt(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-xl border border-orange-200 bg-white p-3 text-sm outline-none transition focus:border-[var(--brand)]"
                />
              </div>

              <div>
                <p className="mb-2 block text-sm font-semibold text-[var(--muted)]">Gele color</p>
                <div className="flex flex-wrap gap-2">
                  {(["auto", "red", "blue", "gold", "green"] as GeleColor[]).map((colorOption) => (
                    <button
                      key={colorOption}
                      type="button"
                      onClick={() => setGeleColor(colorOption)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                        geleColor === colorOption
                          ? "border-[var(--brand)] bg-orange-100 text-[var(--brand-strong)]"
                          : "border-orange-200 bg-white text-[var(--muted)] hover:border-orange-300"
                      }`}
                    >
                      {colorOption}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!selectedFile || isSubmitting}
                onClick={() => void onTransformClick()}
                className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSubmitting ? "Transforming..." : "Transform portrait"}
              </button>
              {error && selectedFile ? (
                <button
                  type="button"
                  onClick={() => void onTransformClick()}
                  disabled={isSubmitting}
                  className="rounded-xl border border-orange-300 bg-white px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Retry last image
                </button>
              ) : null}
              <span className="text-sm text-[var(--muted)]">Selected style: {slugifyStyle(stylePrompt)}</span>
            </div>

            {error ? (
              <div className="md:col-span-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-700">{error}</p>
                {errorDetails ? <p className="mt-1 text-xs text-red-600">{errorDetails}</p> : null}
              </div>
            ) : null}
          </section>
        )}

        {screen === "processing" && (
          <section className="rounded-2xl border border-orange-100 bg-white p-6">
            <h2 className="text-2xl">Processing your image</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Please keep this tab open while we generate your gele-style portrait.</p>

            <div className="mt-6 space-y-3">
              {STAGES.map((stage, index) => {
                const isDone = index < stageIndex;
                const isActive = stage === currentStage;
                return (
                  <div key={stage} className="flex items-center gap-3 rounded-lg border border-orange-100 px-4 py-3">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        isDone ? "bg-green-600" : isActive ? "animate-pulse bg-[var(--brand)]" : "bg-orange-200"
                      }`}
                    />
                    <p className={`text-sm ${isDone || isActive ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>{stage}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {screen === "result" && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl">Your transformed portrait</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--muted)]">Original</p>
                <div className="overflow-hidden rounded-xl border border-orange-100 bg-orange-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {sourceImage ? <img src={sourceImage} alt="Original portrait" className="h-auto w-full object-cover" /> : null}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--muted)]">With gele</p>
                <div className="overflow-hidden rounded-xl border border-orange-100 bg-orange-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {resultImage ? <img src={resultImage} alt="Portrait with gele" className="h-auto w-full object-cover" /> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                download="gele-ai-result.png"
                href={resultImage}
                className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
              >
                Download image
              </a>
              <button
                type="button"
                onClick={resetFlow}
                className="rounded-xl border border-orange-300 px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-orange-50"
              >
                Try another image
              </button>
              {isLoggedIn ? (
                <Link href="/dashboard" className="rounded-xl border border-orange-300 px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-orange-50">
                  View my images
                </Link>
              ) : null}
            </div>
          </section>
        )}
      </div>

      {authOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{authMode === "login" ? "Login" : "Create account"}</h2>
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="rounded-lg border border-orange-200 px-2 py-1 text-xs font-semibold text-[var(--muted)]"
              >
                Close
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${authMode === "login" ? "bg-orange-100 text-[var(--brand-strong)]" : "bg-gray-100"}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${authMode === "signup" ? "bg-orange-100 text-[var(--brand-strong)]" : "bg-gray-100"}`}
              >
                Sign up
              </button>
            </div>

            <form className="space-y-3" onSubmit={(event) => void handleAuthSubmit(event)}>
              {authMode === "signup" ? (
                <>
                  <input
                    value={authFullName}
                    onChange={(event) => setAuthFullName(event.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-orange-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={authCountry}
                    onChange={(event) => setAuthCountry(event.target.value)}
                    placeholder="Country"
                    className="w-full rounded-xl border border-orange-200 px-3 py-2 text-sm"
                  />
                </>
              ) : null}
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-orange-200 px-3 py-2 text-sm"
              />
              <input
                type={showPassword ? "text" : "password"}
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-orange-200 px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="font-semibold hover:text-[var(--brand-strong)]">
                  {showPassword ? "Hide password" : "View password"}
                </button>
                {authMode === "login" ? (
                  <button type="button" onClick={() => void handleForgotPassword()} className="font-semibold hover:text-[var(--brand-strong)]">
                    Forgot password?
                  </button>
                ) : null}
              </div>
              {authMode === "signup" ? (
                <p className="text-xs text-[var(--muted)]">Use at least 8 characters, one uppercase letter, and one number.</p>
              ) : null}

              {authError ? <p className="text-sm text-red-700">{authError}</p> : null}
              {authMessage ? <p className="text-sm text-green-700">{authMessage}</p> : null}

              <button
                disabled={authLoading}
                type="submit"
                className="w-full rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {authLoading ? "Please wait..." : authMode === "login" ? "Login" : "Create account"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
