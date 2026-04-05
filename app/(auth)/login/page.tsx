"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { parseSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { validateEmail, validatePassword, validateTotpCode } from "@/lib/auth/validate";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const defaultRedirect = "/dashboard";

const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectToRaw = searchParams.get("redirectTo");
  const safeRedirect = parseSafeRedirectPath(redirectToRaw) ?? defaultRedirect;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const completeLoginAndRedirect = async () => {
    const supabase = createBrowserSupabaseClient();
    const { data: factorsData, error: factorsError } =
      await supabase.auth.mfa.listFactors();

    if (factorsError != null) {
      setErrorMessage(factorsError.message);
      return;
    }

    const hasVerifiedTotp =
      factorsData?.totp?.some((f) => f.status === "verified") ?? false;

    if (!hasVerifiedTotp) {
      router.replace("/dashboard/settings/mfa?onboarding=1");
      return;
    }

    router.replace(safeRedirect);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
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

    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();

    const { error: signError } = await supabase.auth.signInWithPassword({
      email: emailResult.value,
      password: passResult.value,
    });

    if (signError != null) {
      setIsSubmitting(false);
      setErrorMessage(signError.message);
      return;
    }

    const { data: aalData, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError != null) {
      setIsSubmitting(false);
      setErrorMessage(aalError.message);
      return;
    }

    const needsTotpStep =
      aalData?.nextLevel === "aal2" &&
      aalData?.currentLevel === "aal1";

    if (needsTotpStep) {
      const { data: listData, error: listError } =
        await supabase.auth.mfa.listFactors();

      if (listError != null) {
        setIsSubmitting(false);
        setErrorMessage(listError.message);
        return;
      }

      const verifiedTotp = listData?.totp?.find((f) => f.status === "verified");

      if (verifiedTotp == null) {
        setIsSubmitting(false);
        setErrorMessage(
          "MFA is required but no authenticator is verified. Contact support.",
        );
        return;
      }

      setMfaFactorId(verifiedTotp.id);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    await completeLoginAndRedirect();
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const codeResult = validateTotpCode(totpCode);
    if (!codeResult.ok) {
      setErrorMessage(codeResult.message);
      return;
    }

    if (mfaFactorId == null) {
      setErrorMessage("Session error. Please sign in again.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();

    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: codeResult.value,
    });

    if (mfaError != null) {
      setIsSubmitting(false);
      setErrorMessage(mfaError.message);
      return;
    }

    setIsSubmitting(false);
    setMfaFactorId(null);
    setTotpCode("");
    await completeLoginAndRedirect();
  };

  return (
    <AuthShell title="Sign in">
      {mfaFactorId != null ? (
        <form className="space-y-5" onSubmit={handleTotpSubmit} noValidate>
          {errorMessage != null ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          <p className="text-sm text-zinc-700">
            Enter the 6-digit code from your authenticator app.
          </p>

          <div>
            <label
              htmlFor="login-totp"
              className="block text-sm font-medium text-zinc-800"
            >
              Authenticator code
            </label>
            <input
              id="login-totp"
              name="totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={totpCode}
              onChange={(ev) => setTotpCode(ev.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
              aria-label="Six digit authenticator code"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[#1A1A2E] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#252542] focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 disabled:opacity-60"
          >
            {isSubmitting ? "Verifying…" : "Verify and continue"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMfaFactorId(null);
              setTotpCode("");
              setErrorMessage(null);
            }}
            className="w-full text-sm text-zinc-600 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 rounded-sm"
          >
            Use a different account
          </button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={handlePasswordSubmit} noValidate>
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
              htmlFor="login-email"
              className="block text-sm font-medium text-zinc-800"
            >
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-zinc-800"
            >
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[#1A1A2E] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#252542] focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-zinc-600">
        Need an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-[#1A1A2E] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 rounded-sm"
        >
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
};

const LoginFallback = () => (
  <AuthShell title="Sign in">
    <p className="text-sm text-zinc-600">Loading…</p>
  </AuthShell>
);

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
