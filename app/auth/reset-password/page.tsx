"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (password.length < 8 || !hasUpper || !hasNumber) {
      setError("Password must be at least 8 characters, with an uppercase letter and a number.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully. You can now login.");
    setLoading(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8">
      <div className="w-full rounded-2xl border border-orange-100 bg-white p-6 shadow-lg">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Set a new password for your account.</p>

        <form className="mt-4 space-y-3" onSubmit={(event) => void onSubmit(event)}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
            className="w-full rounded-xl border border-orange-200 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-xl border border-orange-200 px-3 py-2 text-sm"
          />
          <p className="text-xs text-[var(--muted)]">Use at least 8 characters, one uppercase letter, and one number.</p>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {message ? <p className="text-sm text-green-700">{message}</p> : null}

          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[var(--brand-strong)]">
          Back to home
        </Link>
      </div>
    </main>
  );
}
