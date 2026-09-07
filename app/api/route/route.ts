// GET /api/route?path=&variant= — route to document, across both sources.
//
// Nothing here branches on origin. That is the whole point: a page can move between git
// and the CMS and this handler does not change.

import { NextResponse } from "next/server";
import { authorised, DRAFT_HEADERS } from "@/lib/auth";
import { siteGraph } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const path = params.get("path");
  const variant = params.get("variant");

  if (!path) return NextResponse.json({ error: "path is required" }, { status: 400 });
  if (variant !== "draft" && variant !== "published") {
    return NextResponse.json({ error: "variant is required" }, { status: 400 });
  }
  if (variant === "draft" && !authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const graph = await siteGraph(variant);
  const node = graph.byRoute.get(path);
  if (!node) return NextResponse.json({ error: "not found", path }, { status: 404 });

  return NextResponse.json(
    node,
    variant === "draft" ? { headers: DRAFT_HEADERS } : undefined
  );
}
