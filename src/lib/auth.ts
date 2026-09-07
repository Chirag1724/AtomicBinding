// Writes, and any read of a draft, need the token.
//
// Auth proper is bought, not built — getting it wrong is a security incident. This is
// the seam it will slot into: one function, called by every handler that needs it.

import { NextResponse } from "next/server";

export function tokenOf(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return new URL(request.url).searchParams.get("token");
}

export function authorised(request: Request): boolean {
  const expected = process.env.IMPRINT_TOKEN;
  if (!expected) return false;
  return tokenOf(request) === expected;
}

/** Null when the caller may proceed; a 401 response when it may not. */
export function guard(request: Request): NextResponse | null {
  if (authorised(request)) return null;
  return NextResponse.json(
    { error: "unauthorised", detail: "Send IMPRINT_TOKEN as `Authorization: Bearer <token>`." },
    { status: 401 }
  );
}

/** Every response that can contain a draft carries these. */
export const DRAFT_HEADERS = {
  "X-Robots-Tag": "noindex",
  "Cache-Control": "private, no-store",
};
