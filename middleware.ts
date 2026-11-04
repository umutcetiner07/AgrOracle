import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token

    if (token?.role === "SUPER_ADMIN" && !req.nextUrl.pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/admin", req.url))
    }

    if (token?.role === "COOP_MANAGER" && !req.nextUrl.pathname.startsWith("/cooperative")) {
      return NextResponse.redirect(new URL("/cooperative", req.url))
    }

    if (token?.role === "FARMER" && !req.nextUrl.pathname.startsWith("/farmer")) {
      return NextResponse.redirect(new URL("/farmer", req.url))
    }

    if (token?.role === "WATER_COMMITTEE" && !req.nextUrl.pathname.startsWith("/reports")) {
      return NextResponse.redirect(new URL("/reports", req.url))
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        return pathname === "/" || pathname === "/farmer" || !!token
      }
    }
  }
)

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"] }