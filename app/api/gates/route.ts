// GET /api/gates — the six build gates, run against the live graph.
//
// The CLI runs the same function in CI. This endpoint exists so the studio can show the
// same findings without shelling out.

import { NextResponse } from "next/server";
import { runGates } from "@imprint/graph";
import { guard } from "@/lib/auth";
import { registry, siteGraph } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const variant = new URL(request.url).searchParams.get("variant") === "draft" ? "draft" : "published";
  const report = runGates(await siteGraph(variant), registry);
  return NextResponse.json(report, { status: report.ok ? 200 : 422 });
}
