"use client";

import { useState } from "react";

type PlanId = "monthly" | "annual";

export const SubscribePlans = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  const handleChoosePlan = async (plan: PlanId) => {
    setErrorMessage(null);
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data != null &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Checkout could not be started.";
        setErrorMessage(msg);
        setLoadingPlan(null);
        return;
      }
      if (
        data == null ||
        typeof data !== "object" ||
        !("url" in data) ||
        typeof (data as { url: unknown }).url !== "string"
      ) {
        setErrorMessage("Invalid response from checkout.");
        setLoadingPlan(null);
        return;
      }
      const url = (data as { url: string }).url.trim();
      if (url.length === 0 || url.length > 8192) {
        setErrorMessage("Invalid checkout URL.");
        setLoadingPlan(null);
        return;
      }
      window.location.href = url;
    } catch {
      setErrorMessage("Something went wrong. Try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage != null ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Monthly</h2>
          <p className="mt-2 text-2xl font-bold text-zinc-900">$149</p>
          <p className="text-sm text-zinc-600">per month</p>
          <button
            type="button"
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#1A1A2E] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#252542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A2E] disabled:opacity-60"
            disabled={loadingPlan != null}
            aria-label="Subscribe to monthly plan"
            onClick={() => void handleChoosePlan("monthly")}
          >
            {loadingPlan === "monthly" ? "Loading…" : "Choose monthly"}
          </button>
        </div>
        <div className="relative flex flex-col rounded-lg border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm">
          <span className="absolute right-4 top-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white">
            Save 28%
          </span>
          <h2 className="text-base font-semibold text-zinc-900">Annual</h2>
          <p className="mt-2 text-2xl font-bold text-zinc-900">$1,290</p>
          <p className="text-sm text-zinc-600">per year</p>
          <button
            type="button"
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60"
            disabled={loadingPlan != null}
            aria-label="Subscribe to annual plan"
            onClick={() => void handleChoosePlan("annual")}
          >
            {loadingPlan === "annual" ? "Loading…" : "Choose annual"}
          </button>
        </div>
      </div>
    </div>
  );
};
