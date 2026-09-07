// Feeds resolved from the graph, from their own declaration.
//
// A feed says which type it gathers and how to order it; the graph does the rest. That
// is why adding a feed is a schema change and not a code change.

import type { FeedDef, Registry } from "@imprint/schema";
import type { Graph } from "./build";
import type { Node } from "./node";

/** One feed item: the document's data, plus the node fields a card usually wants. */
export type FeedItem = Record<string, unknown>;

function itemOf(node: Node): FeedItem {
  return {
    ...node.data,
    title: node.title,
    summary: node.summary,
    route: node.route,
    updatedAt: node.updatedAt,
    source: node.source,
  };
}

function sortValue(item: FeedItem, field: string): string | number {
  const value = item[field];
  if (typeof value === "number") return value;
  return typeof value === "string" ? value : "";
}

export function resolveFeed(graph: Graph, feed: FeedDef): FeedItem[] {
  if (!feed.select) return [];
  const { type, sort = "updatedAt", direction = "desc", limit } = feed.select;

  const items = graph.nodes
    .filter((node) => node.type === type)
    .map(itemOf)
    .sort((a, b) => {
      const left = sortValue(a, sort);
      const right = sortValue(b, sort);
      const order = left < right ? -1 : left > right ? 1 : 0;
      return direction === "asc" ? order : -order;
    });

  return limit ? items.slice(0, limit) : items;
}

/**
 * The resolution root a binding reads against: every declared feed under its own name,
 * plus the document's own data so a `self` binding works unprefixed.
 */
export function bindingRoot(
  graph: Graph,
  registry: Registry,
  node: Node,
  aliases: Record<string, string> = {}
): Record<string, unknown> {
  const root: Record<string, unknown> = { ...node.data };

  for (const [name, feed] of Object.entries(registry.feeds)) {
    const items = resolveFeed(graph, feed);
    const payload = feed.container ? { [feed.container]: items } : items;
    root[name] = payload;
    // An aliased feed is also reachable under the name this deployment stored.
    const alias = aliases[name];
    if (alias && alias !== name) root[alias] = payload;
  }

  return root;
}
