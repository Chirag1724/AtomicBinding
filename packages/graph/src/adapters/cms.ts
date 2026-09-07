// The CMS adapter: rows from our own content service.
//
// It emits exactly the node shape the filesystem adapter does, which is what lets a
// page move between sources with no route-code change at all.

import { routeFor, searchTextOf, type Registry } from "@imprint/schema";
import type { Store } from "@imprint/store";
import type { Adapter, LoadContext, Node } from "../node";

export function cmsAdapter(store: Store, registry: Registry): Adapter {
  return {
    id: "cms",
    async load(ctx: LoadContext): Promise<Node[]> {
      const rows = store.all(ctx.variant);
      const nodes: Node[] = [];

      for (const row of rows) {
        const def = registry.documents[row.type];
        if (!def) {
          // A type was removed from the schema while rows still name it. Surfaced by
          // gate 4 rather than crashing the build here.
          continue;
        }

        const data = row.data;
        const title = String(data[def.titleField] ?? "(untitled)");
        const summary = typeof data.summary === "string" ? data.summary : "";

        // The stored route wins: it is what the unique index enforced at publish time.
        let route = row.route;
        if (route === null && def.route) {
          try { route = routeFor(def, data); } catch { route = null; }
        }

        nodes.push({
          id: row.id,
          route,
          source: "cms",
          type: row.type,
          section: def.section,
          title,
          summary,
          data,
          blocks: Array.isArray(data.body) ? (data.body as Node["blocks"]) : [],
          refs: [],
          outboundLinks: [],
          searchText: searchTextOf(data),
          updatedAt: row.updatedAt,
          draft: row.variant === "draft",
          violations: [],
          schemaVer: row.schemaVer,
        });
      }

      return nodes;
    },
  };
}
