import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSessionInMiddleware } from "@/lib/supabase/middleware";

const SUBSCRIPTION_ALLOWED = new Set(["active", "beta"]);

export const middleware = async (request: NextRequest) => {
  const { user, response, supabase } = await updateSessionInMiddleware(request);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "redirectTo",
      `${pathname}${search === "" ? "" : search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  if (
    user != null &&
    pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/dashboard/settings/billing")
  ) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError == null) {
      const status = profile?.subscription_status?.trim() ?? "";
      if (!SUBSCRIPTION_ALLOWED.has(status)) {
        const subscribeUrl = request.nextUrl.clone();
        subscribeUrl.pathname = "/subscribe";
        subscribeUrl.search = "";
        return NextResponse.redirect(subscribeUrl);
      }
    }
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/dashboard";
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  return response;
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
