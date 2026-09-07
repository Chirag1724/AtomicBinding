// GET /api/inbound?route= — who links here.
//
// The unpublish guard reads this, and so does the studio before it lets anyone remove a
// published page.

import { NextResponse } from "next/server";
import { inboundReport } from "@imprint/graph";
import { siteGraph } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const route = new URL(request.url).searchParams.get("route");
  if (!route) return NextResponse.json({ error: "route is required" }, { status: 400 });

  const graph = await siteGraph("published");
  const report = inboundReport(graph, route);
  const holders = (graph.inbound.get(route) ?? []).map((node) => ({
    id: node.id,
    title: node.title,
    route: node.route,
    source: node.source,
    section: node.section,
  }));

  return NextResponse.json({ route, ...report, holders });
}
