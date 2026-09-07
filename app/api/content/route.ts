// GET /api/content?type=&variant=&limit=&cursor=
//
// `variant` is REQUIRED and has no default. Forgetting it should be a 400, not a
// production leak of unpublished pricing.

import { NextResponse } from "next/server";
import { openStore } from "@imprint/store";
import { authorised, DRAFT_HEADERS } from "@/lib/auth";
import { withViolations } from "@/lib/documents";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const variant = params.get("variant");

  if (variant !== "draft" && variant !== "published") {
    return NextResponse.json(
      { error: "variant is required", detail: "Pass ?variant=draft or ?variant=published." },
      { status: 400 }
    );
  }
  if (variant === "draft" && !authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const page = openStore().list({
    variant,
    ...(params.get("type") ? { type: params.get("type")! } : {}),
    ...(params.get("limit") ? { limit: Number(params.get("limit")) } : {}),
    ...(params.get("cursor") ? { cursor: params.get("cursor")! } : {}),
  });

  return NextResponse.json(
    { items: page.items.map(withViolations), nextCursor: page.nextCursor },
    variant === "draft" ? { headers: DRAFT_HEADERS } : undefined
  );
}
