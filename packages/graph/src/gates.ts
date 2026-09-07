// The six build gates.
//
// Each one turns a silent blank page into a named failure, and each names the things
// needed to fix it. They run in CI on every pull request.

import { decompile, roundTrips, type AnyLeaf, type Registry, type Row } from "@imprint/schema";
import type { Graph } from "./build";
import type { Node } from "./node";

export type GateId =
  | "route-uniqueness" | "link-integrity" | "reference-resolution"
  | "schema-validity" | "binding-validity" | "binding-round-trip";

export interface Finding {
  gate: GateId;
  /** `error` fails the build. `warning` is reported and does not. */
  severity: "error" | "warning";
  message: string;
  /** Where to look: the node, and the field path inside it. */
  where: { id: string; source: string; route: string | null; path?: string };
}

export interface GateReport {
  findings: Finding[];
  ok: boolean;
  counts: Record<GateId, number>;
}

const at = (node: Node, path?: string): Finding["where"] => ({
  id: node.id,
  source: node.source,
  route: node.route,
  ...(path ? { path } : {}),
});

// ── 1 · Route uniqueness ────────────────────────────────────────────────────────

export function routeUniqueness(graph: Graph, registry: Registry): Finding[] {
  const findings: Finding[] = [];
  const claimants = new Map<string, Node[]>();

  for (const node of graph.nodes) {
    if (!node.route) continue;
    const list = claimants.get(node.route) ?? [];
    list.push(node);
    claimants.set(node.route, list);
  }

  for (const [route, nodes] of claimants) {
    if (nodes.length > 1) {
      const named = nodes.map((n) => `${n.source}:${n.id}`).join("  and  ");
      findings.push({
        gate: "route-uniqueness",
        severity: "error",
        message: `two documents claim '${route}' — ${named}`,
        where: at(nodes[0]!),
      });
    }

    // The ownership manifest makes collisions structurally impossible rather than
    // merely caught: a prefix belongs to exactly one source.
    const owner = (() => {
      try { return registry.ownerOf(route); } catch { return null; }
    })();
    const node = nodes[0]!;
    if (owner && owner !== node.source) {
      findings.push({
        gate: "route-uniqueness",
        severity: "error",
        message: `'${route}' is owned by ${owner}, but a ${node.source} document claims it`,
        where: at(node),
      });
    }
  }

  return findings;
}

// ── 2 · Link integrity ──────────────────────────────────────────────────────────

export function linkIntegrity(graph: Graph, registry: Registry): Finding[] {
  const findings: Finding[] = [];
  for (const node of graph.nodes) {
    for (const link of node.outboundLinks) {
      if (graph.byRoute.has(link)) continue;
      // Routes the application serves are valid targets the graph never claims.
      if (registry.isAppRoute(link)) continue;
      findings.push({
        gate: "link-integrity",
        severity: "error",
        message: `${node.route ?? node.id} → ${link} — nothing answers to that route`,
        where: at(node, link),
      });
    }
  }
  return findings;
}

// ── 3 · Reference resolution ────────────────────────────────────────────────────

export function referenceResolution(graph: Graph): Finding[] {
  const findings: Finding[] = [];
  for (const node of graph.nodes) {
    for (const ref of node.refs) {
      if (!ref.missing) continue;
      findings.push({
        gate: "reference-resolution",
        severity: "error",
        message:
          `${node.type} '${node.title}' references ${ref._source}:${ref._ref} at '${ref.path}', ` +
          `and nothing in the graph answers to it`,
        where: at(node, ref.path),
      });
    }
  }
  return findings;
}

// ── 4 · Schema validity ─────────────────────────────────────────────────────────

export function schemaValidity(graph: Graph): Finding[] {
  const findings: Finding[] = [];
  for (const node of graph.nodes) {
    for (const violation of node.violations) {
      findings.push({
        gate: "schema-validity",
        severity: "error",
        message:
          `${node.type} ${node.id}${violation.path ? ` at '${violation.path}'` : ""}: ` +
          `${violation.message}` +
          (violation.expected ? ` (expected ${violation.expected})` : ""),
        where: at(node, violation.path),
      });
    }
  }
  return findings;
}

// ── 5 · Binding validity ────────────────────────────────────────────────────────

/** Every block instance in the graph that carries stored binding rows. */
function boundBlocks(graph: Graph): { node: Node; path: string; type: string; rows: Row[] }[] {
  const found: { node: Node; path: string; type: string; rows: Row[] }[] = [];
  for (const node of graph.nodes) {
    node.blocks.forEach((instance, index) => {
      const rows = instance._binding;
      if (!Array.isArray(rows) || rows.length === 0) return;
      found.push({ node, path: `body[${index}]`, type: instance._type, rows: rows as Row[] });
    });
  }
  return found;
}

export function bindingValidity(graph: Graph, registry: Registry): Finding[] {
  const findings: Finding[] = [];

  for (const { node, path, type, rows } of boundBlocks(graph)) {
    const block = registry.blocks[type];
    if (!block) continue; // gate 4 already names the unknown block type.

    const card = block.card;
    if (!card) {
      findings.push({
        gate: "binding-validity",
        severity: "error",
        message: `block '${type}' has binding rows but declares no card shape to bind into`,
        where: at(node, path),
      });
      continue;
    }

    let def;
    try {
      def = decompile(rows);
    } catch (error) {
      findings.push({
        gate: "binding-validity",
        severity: "error",
        message: `block '${type}': ${(error as Error).message}`,
        where: at(node, path),
      });
      continue;
    }

    if (def.feed !== null) {
      const feed = registry.feeds[def.feed];
      if (!feed) {
        findings.push({
          gate: "binding-validity",
          severity: "error",
          message: `block '${type}' binds feed '${def.feed}', which no schema declares`,
          where: at(node, path),
        });
        continue;
      }
      if ((feed.container ?? null) !== (def.container ?? null)) {
        findings.push({
          gate: "binding-validity",
          severity: "error",
          message:
            `feed '${def.feed}' nests rows under ` +
            `${feed.container ? `'${feed.container}'` : "no container"}, ` +
            `but the binding reads ${def.container ? `'${def.container}'` : "none"}`,
          where: at(node, path),
        });
        continue;
      }

      for (const { target, path: fieldPath } of def.rule) {
        const declared = feed.item[fieldPath] as AnyLeaf | undefined;
        if (!declared) {
          findings.push({
            gate: "binding-validity",
            severity: "error",
            message: `feed '${def.feed}' declares no path '${fieldPath}' (block '${type}', prop '${target}')`,
            where: at(node, `${path}.${target}`),
          });
          continue;
        }
        const prop = card[target] as AnyLeaf | undefined;
        if (!prop) {
          findings.push({
            gate: "binding-validity",
            severity: "error",
            message: `block '${type}' has no prop '${target}' to bind into`,
            where: at(node, `${path}.${target}`),
          });
          continue;
        }
        if (prop.brand !== declared.brand) {
          findings.push({
            gate: "binding-validity",
            severity: "error",
            message:
              `'${def.feed}.${fieldPath}' is ${declared.brand}, but prop '${target}' of ` +
              `block '${type}' is ${prop.brand}`,
            where: at(node, `${path}.${target}`),
          });
        }
      }
    }
  }

  return findings;
}

// ── 6 · Binding round-trip ──────────────────────────────────────────────────────

export function bindingRoundTrip(graph: Graph): Finding[] {
  const findings: Finding[] = [];
  for (const { node, path, type, rows } of boundBlocks(graph)) {
    if (roundTrips(rows)) continue;
    findings.push({
      gate: "binding-round-trip",
      severity: "error",
      message:
        `block '${type}' has binding rows the compiler cannot reproduce. The typed form ` +
        `must be a lossless view of stored data, so this is a compiler bug, not a content bug.`,
      where: at(node, path),
    });
  }
  return findings;
}

// ── The runner ──────────────────────────────────────────────────────────────────

export function runGates(graph: Graph, registry: Registry): GateReport {
  const findings = [
    ...routeUniqueness(graph, registry),
    ...linkIntegrity(graph, registry),
    ...referenceResolution(graph),
    ...schemaValidity(graph),
    ...bindingValidity(graph, registry),
    ...bindingRoundTrip(graph),
  ];

  const counts = {
    "route-uniqueness": 0, "link-integrity": 0, "reference-resolution": 0,
    "schema-validity": 0, "binding-validity": 0, "binding-round-trip": 0,
  } as Record<GateId, number>;
  for (const finding of findings) counts[finding.gate] += 1;

  return { findings, counts, ok: findings.every((f) => f.severity !== "error") };
}
