import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const path = req.nextUrl.pathname;

  // /admin-login sendiri mengalihkan admin yang sudah login (perlu cek is_admin, bukan hanya session)
  if (path === "/admin" || path.startsWith("/admin/")) {
    if (!data.user) {
      const url = new URL("/admin-login", req.url);
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  }
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*", "/admin-login"] };
