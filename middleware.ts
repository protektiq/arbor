import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSessionInMiddleware } from "@/lib/supabase/middleware";

export const middleware = async (request: NextRequest) => {
  const { user, response } = await updateSessionInMiddleware(request);
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
