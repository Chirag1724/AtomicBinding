// The git-owned adapter: markdown beside the code, reviewed in the same PR.
//
// A docs change is one pull request, blameable, and testable in CI. Nothing about this
// adapter reaches the database, which is the whole point of keeping it.

import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { Section } from "@imprint/schema";
import type { Adapter, LoadContext, Node } from "../node";
import { readFrontmatter } from "./frontmatter";
import { markdownToBlocks, plainText, resetKeys } from "./markdown";

/** Directory under content/ -> the type and section it produces. */
const FOLDERS: Record<string, { type: string; section: Section; prefix: string }> = {
  docs: { type: "docsPage", section: "docs", prefix: "/docs" },
  blog: { type: "blogPost", section: "blog", prefix: "/blog" },
};

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith(".md")) files.push(full);
  }
  return files.sort();
}

/** content/docs/v2/webhooks.md -> /docs/v2/webhooks ; .../index.md -> /docs/v2 */
function routeOf(prefix: string, relativePath: string): string {
  const withoutExt = relativePath.replace(/\.md$/, "");
  const segments = withoutExt.split(sep).filter(Boolean);
  if (segments[segments.length - 1] === "index") segments.pop();
  return segments.length ? `${prefix}/${segments.join("/")}` : prefix;
}

export function fsAdapter(): Adapter {
  return {
    id: "git",
    async load(ctx: LoadContext): Promise<Node[]> {
      resetKeys();
      const nodes: Node[] = [];

      for (const [folder, config] of Object.entries(FOLDERS)) {
        const base = join(ctx.root, "content", folder);
        for (const file of await walk(base)) {
          const raw = await readFile(file, "utf8");
          const { data, body } = readFrontmatter(raw);
          const relativePath = relative(base, file);
          const route = routeOf(config.prefix, relativePath);
          const id = relative(ctx.root, file);

          // Git content is branch-frozen: a draft flag in frontmatter is the only way
          // to withhold it, and it is honoured on both variants.
          const isDraft = data.draft === true;
          if (isDraft && ctx.variant === "published") continue;

          const blocks = markdownToBlocks(body, route.replace(/\W+/g, "").slice(0, 12) || "n");
          const title = typeof data.title === "string" ? data.title : route;
          const summary = typeof data.summary === "string"
            ? data.summary
            : plainText(blocks.find((b) => b._type === "richTextBlock")?.body as never).slice(0, 200);

          nodes.push({
            id,
            route,
            source: "git",
            type: config.type,
            section: config.section,
            title,
            summary,
            // Blocks live in `data.body` for git content too, so the document type
            // validates them and the front end has one shape rather than two.
            data: { ...data, title, summary, body: blocks },
            blocks,
            refs: [],
            outboundLinks: [],
            searchText: `${title} ${summary} ${blocks.map((b) => plainText(b.body as never)).join(" ")}`
              .replace(/\s+/g, " ")
              .trim(),
            ...(typeof data.version === "string" ? { version: data.version } : {}),
            updatedAt: typeof data.updated === "string" ? data.updated : new Date(0).toISOString(),
            draft: isDraft,
            violations: [],
            schemaVer: 1,
          });
        }
      }

      return nodes;
    },
  };
}
