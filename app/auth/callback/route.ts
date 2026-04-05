import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { parseSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { getValidatedPublicSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export const GET = async (request: Request) => {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next");
  const nextPath = parseSafeRedirectPath(nextRaw) ?? "/dashboard";

  if (code == null || code.length === 0 || code.length > 4096) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const cookieStore = cookies();
  const { url, anonKey } = getValidatedPublicSupabaseConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error != null) {
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "auth_callback");
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
};
