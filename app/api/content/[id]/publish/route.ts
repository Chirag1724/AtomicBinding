// POST /api/content/:id/publish — copy the draft to published.

import { NextResponse } from "next/server";
import { openStore, RouteConflictError } from "@imprint/store";
import { guard } from "@/lib/auth";
import { registry } from "~/schema";
import { validateDocument } from "@imprint/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const store = openStore();
  const draft = store.get(id, "draft");
  if (!draft) return NextResponse.json({ error: "no draft to publish" }, { status: 404 });

  // Never publish something the current schema rejects: an invalid draft is a fixable
  // problem, an invalid published page is an incident.
  const def = registry.documents[draft.type];
  if (def) {
    const result = validateDocument(def, draft.data, registry);
    if (!result.ok) {
      return NextResponse.json(
        { error: "invalid", detail: "fix these before publishing", violations: result.violations },
        { status: 422 }
      );
    }
  }

  try {
    return NextResponse.json(store.publish(id, "studio"));
  } catch (error) {
    if (error instanceof RouteConflictError) {
      return NextResponse.json(
        { error: "route conflict", detail: error.message, route: error.route, heldBy: error.heldBy },
        { status: 409 }
      );
    }
    throw error;
  }
}
