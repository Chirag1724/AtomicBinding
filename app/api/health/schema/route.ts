// GET /api/health/schema — documents failing the CURRENT schema, grouped for triage.
//
// Validate-on-read means these are served, not lost. This endpoint is what turns
// "somewhere out there a document is wrong" into a list an admin can work through.

import { NextResponse } from "next/server";
import { validateDocument } from "@imprint/schema";
import { openStore } from "@imprint/store";
import { guard } from "@/lib/auth";
import { registry } from "~/schema";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const store = openStore();
  const byType: Record<string, {
    label: string;
    schemaVersion: number;
    behind: number;
    failing: { id: string; version: number; schemaVer: number; violations: unknown[] }[];
  }> = {};

  for (const def of Object.values(registry.documents)) {
    if (def.source === "git") continue; // files are validated by the gates, not here
    const rows = store.all("draft", def.name);
    const failing = [];
    let behind = 0;

    for (const row of rows) {
      if (row.schemaVer < def.schemaVersion) behind += 1;
      const result = validateDocument(def, row.data, registry);
      if (!result.ok) {
        failing.push({
          id: row.id,
          version: row.version,
          schemaVer: row.schemaVer,
          violations: result.violations,
        });
      }
    }

    if (failing.length || behind) {
      byType[def.name] = { label: def.label, schemaVersion: def.schemaVersion, behind, failing };
    }
  }

  const total = Object.values(byType).reduce((sum, entry) => sum + entry.failing.length, 0);
  return NextResponse.json({ ok: total === 0, total, byType });
}
