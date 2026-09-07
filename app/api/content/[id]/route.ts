// GET  /api/content/:id?variant=   one document, references resolved one level
// PUT  /api/content/:id            save a draft; body carries `version` for the lock

import { NextResponse } from "next/server";
import { ConflictError, openStore } from "@imprint/store";
import { authorised, DRAFT_HEADERS, guard } from "@/lib/auth";
import { withViolations, writeDraft } from "@/lib/documents";
import { registry } from "~/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const variant = new URL(request.url).searchParams.get("variant");

  if (variant !== "draft" && variant !== "published") {
    return NextResponse.json({ error: "variant is required" }, { status: 400 });
  }
  if (variant === "draft" && !authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const store = openStore();
  const document = store.get(id, variant);
  if (!document) return NextResponse.json({ error: "not found" }, { status: 404 });

  // One level of resolution: enough for a card, and it cannot fan out.
  const resolved = Object.fromEntries(
    Object.entries(registry.documents[document.type]?.fields ?? {})
      .filter(([, field]) => field.kind === "reference" || field.kind === "referenceList")
      .map(([name]) => [name, document.data[name]])
  );

  return NextResponse.json(
    { ...withViolations(document), resolved },
    variant === "draft" ? { headers: DRAFT_HEADERS } : undefined
  );
}

export async function PUT(request: Request, { params }: Params) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json()) as {
    type?: string;
    data?: Record<string, unknown>;
    version?: number;
    by?: string;
  };

  if (!body.type || !body.data) {
    return NextResponse.json({ error: "type and data are required" }, { status: 400 });
  }

  try {
    const result = writeDraft(openStore(), {
      id,
      type: body.type,
      data: body.data,
      by: body.by ?? "studio",
      ...(body.version !== undefined ? { expectedVersion: body.version } : {}),
    });

    if (!result.ok) {
      return NextResponse.json({ error: "invalid", violations: result.violations }, { status: 422 });
    }
    return NextResponse.json(result.document, { headers: DRAFT_HEADERS });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json(
        {
          error: "conflict",
          detail: error.message,
          expected: error.expected,
          actual: error.actual,
          updatedBy: error.updatedBy,
        },
        { status: 409 }
      );
    }
    throw error;
  }
}
