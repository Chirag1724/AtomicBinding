// Builds the graph once per site build, and per request for SSR marketing routes.
//
// Adapters load; then references are resolved, links extracted and documents validated
// against the CURRENT schema. A document that fails does not crash the build — it
// carries `violations[]` and shows up in Schema Health.

import {
  extractLinks, extractRefs, validateDocument,
  type Registry, type ResolvedRef,
} from "@imprint/schema";
import type { Adapter, LoadContext, Node } from "./node";

export interface Graph {
  nodes: Node[];
  byRoute: Map<string, Node>;
  byId: Map<string, Node>;
  /** route -> the nodes that link to it. Powers the unpublish guard. */
  inbound: Map<string, Node[]>;
  variant: LoadContext["variant"];
}

export async function buildGraph(options: {
  adapters: Adapter[];
  registry: Registry;
  variant: LoadContext["variant"];
  root: string;
}): Promise<Graph> {
  const { adapters, registry, variant, root } = options;

  const loaded = await Promise.all(adapters.map((adapter) => adapter.load({ variant, root })));
  const nodes = loaded.flat();

  const byId = new Map<string, Node>();
  const byRoute = new Map<string, Node>();
  for (const node of nodes) {
    byId.set(node.id, node);
    // A duplicate route is a gate failure, not a silent overwrite: keep the FIRST so
    // the gate can name both claimants.
    if (node.route && !byRoute.has(node.route)) byRoute.set(node.route, node);
  }

  for (const node of nodes) {
    const def = registry.documents[node.type];
    if (!def) {
      node.violations = [{
        path: "",
        message: `no document type '${node.type}' is registered, but this node claims it`,
      }];
      continue;
    }

    // ── validate on read ──
    const result = validateDocument(def, node.data, registry);
    node.violations = result.violations;

    // ── resolve references, across the source boundary ──
    node.refs = extractRefs(def.fields, node.data, registry).map((ref): ResolvedRef => {
      // A git-owned target has no database id, so its ROUTE is its identity.
      const target = ref._source === "git" ? byRoute.get(ref._ref) : byId.get(ref._ref);
      return {
        _ref: ref._ref,
        _source: ref._source,
        path: ref.path,
        title: target?.title ?? null,
        route: target?.route ?? null,
        missing: !target,
      };
    });

    // ── outbound links: from rich text and link fields, never declared ──
    node.outboundLinks = extractLinks(node.data);
    if (node.blocks.length) {
      const fromBlocks = extractLinks(node.blocks);
      node.outboundLinks = [...new Set([...node.outboundLinks, ...fromBlocks])].sort();
    }
  }

  const inbound = new Map<string, Node[]>();
  for (const node of nodes) {
    for (const link of node.outboundLinks) {
      const holders = inbound.get(link) ?? [];
      holders.push(node);
      inbound.set(link, holders);
    }
    for (const ref of node.refs) {
      if (!ref.route) continue;
      const holders = inbound.get(ref.route) ?? [];
      if (!holders.includes(node)) holders.push(node);
      inbound.set(ref.route, holders);
    }
  }

  return { nodes, byRoute, byId, inbound, variant };
}

/** Who links here, for the unpublish warning. */
export function inboundReport(graph: Graph, route: string): { total: number; bySection: Record<string, number> } {
  const holders = graph.inbound.get(route) ?? [];
  const bySection: Record<string, number> = {};
  for (const node of holders) {
    bySection[node.section] = (bySection[node.section] ?? 0) + 1;
  }
  return { total: holders.length, bySection };
}
