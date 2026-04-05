"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { validateBarNumber, validateEmail, validatePassword } from "@/lib/auth/validate";
import { getValidatedPublicAppUrl } from "@/lib/supabase/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailResult = validateEmail(email);
    if (!emailResult.ok) {
      setErrorMessage(emailResult.message);
      return;
    }

    const passResult = validatePassword(password);
    if (!passResult.ok) {
      setErrorMessage(passResult.message);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    const barResult = validateBarNumber(barNumber);
    if (!barResult.ok) {
      setErrorMessage(barResult.message);
      return;
    }

    let appUrl: string;
    try {
      appUrl = getValidatedPublicAppUrl();
    } catch {
      setErrorMessage(
        "Application URL is not configured. Set NEXT_PUBLIC_APP_URL.",
      );
      return;
    }

    setIsSubmitting(true);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email: emailResult.value,
      password: passResult.value,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
        data: {
          bar_number: barResult.value,
          bar_verified: false,
        },
      },
    });

    setIsSubmitting(false);

    if (error != null) {
      setErrorMessage(error.message);
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <AuthShell title="Check your email">
        <p className="text-sm text-zinc-700">
          Check your email to confirm your account. After confirming, you can
          sign in.
        </p>
        <p className="mt-6 text-center text-sm text-zinc-600">
          <Link
            href="/login"
            className="font-medium text-[#1A1A2E] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 rounded-sm"
          >
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account">
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {errorMessage != null ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <div>
          <label
            htmlFor="signup-email"
            className="block text-sm font-medium text-zinc-800"
          >
            Email
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
            aria-invalid={errorMessage != null}
          />
        </div>

        <div>
          <label
            htmlFor="signup-password"
            className="block text-sm font-medium text-zinc-800"
          >
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
            aria-describedby="signup-password-hint"
          />
          <p id="signup-password-hint" className="mt-1 text-xs text-zinc-500">
            At least 12 characters.
          </p>
        </div>

        <div>
          <label
            htmlFor="signup-confirm"
            className="block text-sm font-medium text-zinc-800"
          >
            Confirm password
          </label>
          <input
            id="signup-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(ev) => setConfirmPassword(ev.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
          />
        </div>

        <div>
          <label
            htmlFor="signup-bar"
            className="block text-sm font-medium text-zinc-800"
          >
            Bar number
          </label>
          <input
            id="signup-bar"
            name="barNumber"
            type="text"
            autoComplete="off"
            required
            maxLength={64}
            value={barNumber}
            onChange={(ev) => setBarNumber(ev.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-[#1A1A2E] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#252542] focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 disabled:opacity-60"
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[#1A1A2E] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 rounded-sm"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
