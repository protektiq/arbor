import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { SubscribePlans } from "./SubscribePlans";

const PAID_ACCESS = new Set(["active", "beta"]);

export default async function SubscribePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user == null) {
    redirect("/login?redirectTo=/subscribe");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  const status = profile?.subscription_status?.trim() ?? "";
  if (PAID_ACCESS.has(status)) {
    redirect("/dashboard");
  }

  return (
    <AuthShell title="Choose your plan">
      <p className="mb-6 text-sm text-zinc-600">
        Select a subscription to access your Arbor dashboard.
      </p>
      <SubscribePlans />
    </AuthShell>
  );
}
