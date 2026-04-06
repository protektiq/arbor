import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getValidatedPublicSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Refreshes the Supabase session in middleware and returns the response that
 * must carry Set-Cookie headers. See auth-helpers cookie contract (getAll/setAll).
 */
export const updateSessionInMiddleware = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey } = getValidatedPublicSupabaseConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response: supabaseResponse, supabase };
};
