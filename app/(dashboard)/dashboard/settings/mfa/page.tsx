"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { validateTotpCode } from "@/lib/auth/validate";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Phase =
  | "loading"
  | "already_enrolled"
  | "ready"
  | "enrolled_pending_verify"
  | "verified";

const MfaContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const refreshFactors = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error != null) {
      setErrorMessage(error.message);
      setPhase("ready");
      return;
    }

    const verified = data?.totp?.filter((f) => f.status === "verified") ?? [];
    if (verified.length > 0) {
      setPhase("already_enrolled");
      return;
    }

    setPhase("ready");
  }, []);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const handleStartEnroll = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator",
    });

    setIsSubmitting(false);

    if (error != null) {
      setErrorMessage(error.message);
      return;
    }

    if (data == null || data.totp == null) {
      setErrorMessage("Could not start authenticator setup.");
      return;
    }

    setFactorId(data.id);
    setQrDataUrl(data.totp.qr_code);
    setTotpUri(data.totp.uri);
    setSecret(data.totp.secret);
    setPhase("enrolled_pending_verify");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const codeResult = validateTotpCode(totpCode);
    if (!codeResult.ok) {
      setErrorMessage(codeResult.message);
      return;
    }

    if (factorId == null) {
      setErrorMessage("Set up your app first using the button above.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: codeResult.value,
    });

    setIsSubmitting(false);

    if (error != null) {
      setErrorMessage(error.message);
      return;
    }

    setPhase("verified");
    setTotpCode("");
    router.replace("/dashboard/settings/mfa");
  };

  if (phase === "loading") {
    return (
      <main className="p-8">
        <p className="text-sm text-zinc-600">Loading…</p>
      </main>
    );
  }

  if (phase === "already_enrolled") {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold text-zinc-900">
          Two-factor authentication
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Your account already has an authenticator app linked.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm font-medium text-[#1A1A2E] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 rounded-sm"
        >
          Back to dashboard
        </Link>
      </main>
    );
  }

  if (phase === "verified") {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold text-zinc-900">
          Authenticator linked
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Two-factor authentication is now active on your account.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm font-medium text-[#1A1A2E] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 rounded-sm"
        >
          Continue to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold text-zinc-900">
        Two-factor authentication
      </h1>

      {onboarding ? (
        <div
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          Complete MFA setup to secure your account.
        </div>
      ) : null}

      {errorMessage != null ? (
        <div
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      {phase === "ready" ? (
        <div className="mt-6">
          <p className="text-sm text-zinc-700">
            Add an authenticator app (such as Google Authenticator or 1Password)
            to protect your Arbor account.
          </p>
          <button
            type="button"
            onClick={handleStartEnroll}
            disabled={isSubmitting}
            className="mt-4 rounded-md bg-[#1A1A2E] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#252542] focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 disabled:opacity-60"
          >
            {isSubmitting ? "Preparing…" : "Set up authenticator"}
          </button>
        </div>
      ) : null}

      {phase === "enrolled_pending_verify" &&
      qrDataUrl != null &&
      factorId != null ? (
        <div className="mt-6 space-y-6">
          <div>
            <p className="text-sm font-medium text-zinc-800">
              Scan this QR code
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Or enter the secret manually if you cannot scan the image.
            </p>
            <div className="mt-3 flex justify-center rounded-lg border border-zinc-200 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL from Supabase TOTP enroll */}
              <img
                src={qrDataUrl}
                alt={
                  totpUri != null
                    ? `Authenticator setup for ${totpUri}`
                    : "Authenticator QR code"
                }
                width={192}
                height={192}
                className="h-48 w-48"
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowSecret((s) => !s)}
              className="text-sm font-medium text-[#1A1A2E] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 rounded-sm"
              aria-expanded={showSecret}
            >
              {showSecret ? "Hide secret" : "Show secret key"}
            </button>
            {showSecret && secret != null ? (
              <p className="mt-2 break-all font-mono text-xs text-zinc-700">
                {secret}
              </p>
            ) : null}
          </div>

          <form className="space-y-4" onSubmit={handleVerify} noValidate>
            <div>
              <label
                htmlFor="mfa-verify-code"
                className="block text-sm font-medium text-zinc-800"
              >
                Enter the 6-digit test code
              </label>
              <input
                id="mfa-verify-code"
                name="totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={totpCode}
                onChange={(ev) => setTotpCode(ev.target.value)}
                className="mt-1 block w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                aria-label="Six digit code from authenticator app"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#1A1A2E] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#252542] focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 disabled:opacity-60"
            >
              {isSubmitting ? "Verifying…" : "Verify and enable MFA"}
            </button>
          </form>
        </div>
      ) : null}

      <p className="mt-8 text-sm">
        <Link
          href="/dashboard"
          className="font-medium text-[#1A1A2E] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:ring-offset-2 rounded-sm"
        >
          Back to dashboard
        </Link>
      </p>
    </main>
  );
};

const MfaFallback = () => (
  <main className="p-8">
    <p className="text-sm text-zinc-600">Loading…</p>
  </main>
);

export default function MfaSettingsPage() {
  return (
    <Suspense fallback={<MfaFallback />}>
      <MfaContent />
    </Suspense>
  );
}
