// Building the graph, once per request.
//
// SSR marketing routes need a fresh graph so a publish appears without a deploy; docs
// routes are static and get theirs at build time. Both call this.

import { buildGraph, cmsAdapter, fsAdapter, type Graph } from "@imprint/graph";
import { openStore } from "@imprint/store";
import { registry } from "~/schema";

export const ROOT = process.cwd();

export async function siteGraph(variant: "draft" | "published" = "published"): Promise<Graph> {
  return buildGraph({
    adapters: [fsAdapter(), cmsAdapter(openStore(), registry)],
    registry,
    variant,
    root: ROOT,
  });
}

export { registry };
