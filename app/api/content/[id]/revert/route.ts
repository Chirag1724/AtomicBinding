// POST /api/content/:id/revert — copy an old version forward as the current draft.

import { NextResponse } from "next/server";
import { openStore } from "@imprint/store";
import { DRAFT_HEADERS, guard } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json()) as { version?: number };
  if (typeof body.version !== "number") {
    return NextResponse.json({ error: "version is required" }, { status: 400 });
  }

  try {
    return NextResponse.json(openStore().revert(id, body.version, "studio"), { headers: DRAFT_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
