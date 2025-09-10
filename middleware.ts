import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Paths that do NOT require authentication
const PUBLIC_PATHS = [
  "/login",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next")) return true; // Next.js static assets
  if (pathname.startsWith("/api")) return true; // APIs will handle auth themselves
  if (pathname.startsWith("/public")) return true;
  if (pathname.startsWith("/assets")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Create a Supabase client using request cookies (read-only in middleware)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(_name: string, _value: string, _options: CookieOptions) {
          // no-op in middleware (can't set cookies here safely)
        },
        remove(_name: string, _options: CookieOptions) {
          // no-op in middleware
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/(.*)"],
};
