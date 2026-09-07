// One type's documents. Status is derived, never stored: a draft ahead of its published
// row IS "has unpublished changes".

import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { validateDocument } from "@imprint/schema";
import { openStore } from "@imprint/store";
import { createDocument } from "@/studio/actions";
import { registry } from "~/schema";

export const dynamic = "force-dynamic";

export default async function TypeList({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const def = registry.documents[type];
  if (!def || def.source === "git") notFound();

  const store = openStore();
  const drafts = store.all("draft", type);
  const published = new Map(store.all("published", type).map((row) => [row.id, row]));

  async function create() {
    "use server";
    // A singleton is created once; opening it again edits the same row.
    const existing = openStore().all("draft", type)[0];
    if (def!.singleton && existing) redirect(`/studio/${type}/${existing.id}`);

    const seed: Record<string, unknown> = {};
    for (const field of def!.manifest) {
      const fallback = field.config.default;
      if (fallback !== undefined) seed[field.name] = fallback;
      else if (field.kind === "blocks") seed[field.name] = [];
      else if (field.kind === "objectList") seed[field.name] = [];
      else if (field.required && field.kind === "text") seed[field.name] = `New ${def!.label.toLowerCase()}`;
      else if (field.required && field.kind === "slug") seed[field.name] = `new-${Date.now().toString(36)}`;
    }

    const result = await createDocument(type, seed);
    if (result.ok && result.id) redirect(`/studio/${type}/${result.id}`);
  }

  return (
    <>
      <p className="eyebrow">{def.section}</p>
      <h1>{def.label}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        {def.route ?? "no route — fetched by type"} · schema v{def.schemaVersion}
        {def.singleton ? " · singleton" : ""}
      </p>

      <form action={create} style={{ marginBottom: 18 }}>
        <button type="submit" className="btn btn-primary">
          {def.singleton ? `Open ${def.label}` : `New ${def.label.toLowerCase()}`}
        </button>
      </form>

      {drafts.length === 0 ? (
        <p className="muted">Nothing here yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="docs">
            <thead>
              <tr>
                <th>Title</th><th>Route</th><th>Status</th><th>Updated</th><th>By</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((row) => {
                const live = published.get(row.id);
                const invalid = !validateDocument(def, row.data, registry).ok;
                return (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/studio/${type}/${row.id}`}>
                        {String(row.data[def.titleField] ?? "(untitled)")}
                      </Link>
                    </td>
                    <td className="muted">{row.route ?? "—"}</td>
                    <td>
                      {!live ? <span className="chip chip-draft">draft</span>
                        : live.version < row.version ? <span className="chip chip-draft">changes</span>
                        : <span className="chip chip-cms">published</span>}
                      {invalid ? <span className="chip chip-fail"> invalid</span> : null}
                    </td>
                    <td className="muted">{new Date(row.updatedAt).toLocaleString()}</td>
                    <td className="muted">{row.updatedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
