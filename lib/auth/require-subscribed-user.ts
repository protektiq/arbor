import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const SUBSCRIPTION_ALLOWED = new Set(["active", "beta"]);

export type SubscribedSupabaseClient = SupabaseClient<Database>;

export type RequireSubscribedUserOk = {
  ok: true;
  user: User;
  supabase: SubscribedSupabaseClient;
};

export type RequireSubscribedUserFail = {
  ok: false;
  response: NextResponse;
};

export type RequireSubscribedUserResult =
  | RequireSubscribedUserOk
  | RequireSubscribedUserFail;

/**
 * For Route Handlers: session required; subscription must be active or beta.
 * Fails closed on profile load errors (unlike dashboard middleware fail-open).
 */
export const requireSubscribedUser =
  async (): Promise<RequireSubscribedUserResult> => {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError != null || user == null) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError != null) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Could not load billing profile." },
          { status: 500 },
        ),
      };
    }

    const status = profile?.subscription_status?.trim() ?? "";
    if (!SUBSCRIPTION_ALLOWED.has(status)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "An active subscription is required." },
          { status: 403 },
        ),
      };
    }

    return { ok: true, user, supabase };
  };
