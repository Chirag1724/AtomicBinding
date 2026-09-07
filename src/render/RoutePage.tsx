// One route handler for BOTH sources.
//
// Nothing here asks where a page came from. That is what makes moving /pricing between
// git and the CMS a content change rather than a code change.

import { notFound } from "next/navigation";
import { bindingRoot, type Graph } from "@imprint/graph";
import { registry, siteGraph } from "@/lib/graph";
import { BlockList } from "./BlockList";
import { PreviewCanvas } from "./PreviewCanvas";

export interface RoutePageProps {
  path: string;
  preview?: boolean;
}

/** Docs and blog index pages list their section rather than rendering an empty body. */
function SectionIndex({ graph, prefix }: { graph: Graph; prefix: string }) {
  const pages = graph.nodes
    .filter((node) => node.route && node.route.startsWith(`${prefix}/`))
    .sort((a, b) => a.route!.localeCompare(b.route!));

  return (
    <ul className="pagelist">
      {pages.map((page) => (
        <li key={page.route}>
          <a href={page.route!}>
            <span className="pagelist-title">
              {page.title}
              <span className="pagelist-sum">{page.summary}</span>
            </span>
            <span className={`chip chip-${page.source}`}>{page.version ?? page.source}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export async function RoutePage({ path, preview = false }: RoutePageProps) {
  // A preview reads drafts; everything else reads published only.
  const graph = await siteGraph(preview ? "draft" : "published");
  const node = graph.byRoute.get(path);

  if (!node) notFound();

  const root = bindingRoot(graph, registry, node);
  const studioOrigin = process.env.IMPRINT_STUDIO_ORIGIN ?? "http://localhost:3100";

  const isIndex = path === "/docs" || path === "/blog";

  return (
    <main>
      <div className="meta">
        <span className={`chip chip-${node.source}`}>{node.source}</span>
        {node.draft ? <span className="chip chip-draft">draft</span> : null}
        {node.violations.length ? (
          <span className="chip chip-fail">{node.violations.length} schema violation(s)</span>
        ) : null}
        <span>{node.type}</span>
        {node.version ? <span>{node.version}</span> : null}
      </div>

      <h1>{node.title}</h1>
      {node.summary ? <p className="lede">{node.summary}</p> : null}

      {preview ? (
        <PreviewCanvas initialBlocks={node.blocks} root={root} studioOrigin={studioOrigin} />
      ) : (
        <BlockList blocks={node.blocks} root={root} />
      )}

      {isIndex ? <SectionIndex graph={graph} prefix={path} /> : null}
    </main>
  );
}
