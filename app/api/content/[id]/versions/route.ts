// GET /api/content/:id/versions — history.

import { NextResponse } from "next/server";
import { openStore } from "@imprint/store";
import { DRAFT_HEADERS, guard } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  return NextResponse.json(openStore().versions(id), { headers: DRAFT_HEADERS });
}
