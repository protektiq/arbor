import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { ManageBillingButton } from "./ManageBillingButton";

const planLabel = (plan: string | null): string => {
  if (plan == null || plan.trim().length === 0) {
    return "Not set";
  }
  switch (plan.trim()) {
    case "monthly":
      return "Monthly";
    case "annual":
      return "Annual";
    case "beta":
      return "Beta";
    default:
      return plan.trim();
  }
};

const statusLabel = (status: string | null): string => {
  if (status == null || status.trim().length === 0) {
    return "Unknown";
  }
  switch (status.trim()) {
    case "inactive":
      return "Inactive";
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "cancelled":
      return "Cancelled";
    case "beta":
      return "Beta access";
    default:
      return status.trim();
  }
};

export default async function BillingSettingsPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user == null) {
    redirect("/login?redirectTo=/dashboard/settings/billing");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "subscription_plan, subscription_status, stripe_customer_id",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error != null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-red-700">
          Could not load billing settings. Try again later.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-[#1A1A2E] underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const customerId = profile?.stripe_customer_id?.trim() ?? "";
  const hasStripeCustomer =
    customerId.length > 0 && customerId.length <= 256;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900"
      >
        Back to dashboard
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-zinc-900">
        Billing
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        View your plan and open the secure Stripe customer portal to update
        payment methods or cancel.
      </p>
      <dl className="mt-8 space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Plan
          </dt>
          <dd className="mt-1 text-sm font-medium text-zinc-900">
            {planLabel(profile?.subscription_plan ?? null)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Status
          </dt>
          <dd className="mt-1 text-sm font-medium text-zinc-900">
            {statusLabel(profile?.subscription_status ?? null)}
          </dd>
        </div>
      </dl>
      <div className="mt-8">
        <ManageBillingButton hasStripeCustomer={hasStripeCustomer} />
      </div>
    </div>
  );
}
