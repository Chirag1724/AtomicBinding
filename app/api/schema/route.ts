// GET /api/schema — the field manifests, for the studio's recursive renderer.
//
// The studio holds NO copy of the schema. It renders whatever this returns, which is why
// a new field type never needs a studio release.

import { NextResponse } from "next/server";
import { registry } from "~/schema";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    documents: Object.values(registry.documents).map((def) => ({
      name: def.name,
      label: def.label,
      titleField: def.titleField,
      route: def.route ?? null,
      section: def.section,
      source: def.source,
      singleton: Boolean(def.singleton),
      schemaVersion: def.schemaVersion,
      kind: def.kind,
      fields: def.manifest,
    })),
    blocks: Object.values(registry.blocks).map((def) => ({
      name: def.name,
      label: def.label,
      surfaces: def.surfaces,
      deprecated: Boolean(def.deprecated),
      hasCard: Boolean(def.card),
      card: def.card ? Object.fromEntries(Object.entries(def.card).map(([k, v]) => [k, v.brand])) : null,
      defaultRows: def.rows,
      fields: def.manifest,
    })),
    feeds: Object.values(registry.feeds).map((feed) => ({
      name: feed.name,
      label: feed.label ?? feed.name,
      container: feed.container,
      query: Boolean(feed.query),
      item: Object.fromEntries(Object.entries(feed.item).map(([path, leaf]) => [path, leaf.brand])),
    })),
    ownership: registry.ownership,
  });
}
