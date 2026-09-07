// The unified graph's node type.
//
// Both adapters emit this. NOTHING downstream branches on `source` — the router, the
// sitemap, the link resolver and the search index all read the same shape. `source` is
// carried so the studio can show a quiet chip, not so code can special-case.

import type { BlockInstance, ResolvedRef, Section, Source, Violation } from "@imprint/schema";

export interface Node {
  /** A CMS uuid, or the file path for a git-owned node. */
  id: string;
  route: string | null;
  source: Source;
  type: string;
  section: Section;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  blocks: BlockInstance[];
  /** Resolved: each carries its target's title and route, or is flagged missing. */
  refs: ResolvedRef[];
  /** Extracted from rich text and link fields. Never declared. */
  outboundLinks: string[];
  searchText: string;
  /** Docs only. */
  version?: string;
  updatedAt: string;
  draft: boolean;
  /** Non-empty when the node fails the CURRENT schema. It still renders. */
  violations: Violation[];
  schemaVer: number;
}

export interface LoadContext {
  variant: "draft" | "published";
  /** Repository root, for the filesystem adapter. */
  root: string;
}

export interface Adapter {
  id: Source;
  load(ctx: LoadContext): Promise<Node[]>;
}
