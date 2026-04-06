"use client";

import { useState } from "react";

type ManageBillingButtonProps = {
  hasStripeCustomer: boolean;
};

export const ManageBillingButton = ({
  hasStripeCustomer,
}: ManageBillingButtonProps) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleManageBilling = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data != null &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Could not open billing portal.";
        setErrorMessage(msg);
        setIsLoading(false);
        return;
      }
      if (
        data == null ||
        typeof data !== "object" ||
        !("url" in data) ||
        typeof (data as { url: unknown }).url !== "string"
      ) {
        setErrorMessage("Invalid response from billing portal.");
        setIsLoading(false);
        return;
      }
      const url = (data as { url: string }).url.trim();
      if (url.length === 0 || url.length > 8192) {
        setErrorMessage("Invalid portal URL.");
        setIsLoading(false);
        return;
      }
      window.location.href = url;
    } catch {
      setErrorMessage("Something went wrong. Try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {errorMessage != null ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md bg-[#1A1A2E] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#252542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A2E] disabled:opacity-60"
        disabled={!hasStripeCustomer || isLoading}
        aria-label="Open Stripe customer billing portal"
        onClick={() => void handleManageBilling()}
      >
        {isLoading ? "Opening…" : "Manage billing"}
      </button>
      {!hasStripeCustomer ? (
        <p className="text-sm text-zinc-600">
          Complete a subscription checkout to manage payment methods and
          invoices here.
        </p>
      ) : null}
    </div>
  );
};
