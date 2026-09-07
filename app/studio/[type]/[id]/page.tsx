// The editor page. It gathers what the client editor needs and hands it the server
// actions; the token never crosses into the browser.

import { notFound } from "next/navigation";
import { openStore } from "@imprint/store";
import { Editor } from "@/studio/Editor";
import type { BlockMeta } from "@/studio/BlockComposer";
import type { RefCandidate } from "@/studio/FieldRenderer";
import { publishDocument, revertDocument, saveDraft, unpublishDocument } from "@/studio/actions";
import { siteGraph } from "@/lib/graph";
import { registry } from "~/schema";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  const def = registry.documents[type];
  if (!def || def.source === "git") notFound();

  const store = openStore();
  const draft = store.get(id, "draft");
  if (!draft) notFound();

  const published = store.get(id, "published");

  // Reference candidates come from the GRAPH, not the store, so a git-owned docs page is
  // pickable exactly like a CMS row. This is the cross-source relation, in the editor.
  const graph = await siteGraph("published");
  const candidates: Record<string, RefCandidate[]> = {};
  for (const node of graph.nodes) {
    (candidates[node.type] ??= []).push({
      id: node.source === "git" ? node.route ?? node.id : node.id,
      title: node.title,
      route: node.route,
      source: node.source,
    });
  }
  for (const list of Object.values(candidates)) list.sort((a, b) => a.title.localeCompare(b.title));

  const blockMeta: Record<string, BlockMeta> = Object.fromEntries(
    Object.values(registry.blocks).map((block) => [
      block.name,
      {
        name: block.name,
        label: block.label,
        deprecated: Boolean(block.deprecated),
        surfaces: block.surfaces,
        fields: block.manifest,
        defaultRows: block.rows,
        hasCard: Boolean(block.card),
      },
    ])
  );

  return (
    <Editor
      id={id}
      type={type}
      typeLabel={def.label}
      fields={def.manifest}
      initialData={draft.data}
      version={draft.version}
      publishedVersion={published?.version ?? null}
      routeTemplate={def.route ?? null}
      blockMeta={blockMeta}
      candidates={candidates}
      feeds={Object.values(registry.feeds).map((feed) => ({ name: feed.name, label: feed.label ?? feed.name }))}
      versions={store.versions(id).map((entry) => ({
        version: entry.version,
        createdAt: entry.createdAt,
        createdBy: entry.createdBy,
      }))}
      actions={{
        save: saveDraft,
        publish: publishDocument,
        unpublish: unpublishDocument,
        revert: revertDocument,
      }}
    />
  );
}
