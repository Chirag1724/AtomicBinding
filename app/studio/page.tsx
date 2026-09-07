// The content dashboard: every type, what is in it, and what is wrong.

import Link from "next/link";
import { openStore } from "@imprint/store";
import { validateDocument } from "@imprint/schema";
import { registry } from "~/schema";

export const dynamic = "force-dynamic";

export default function StudioHome() {
  const store = openStore();

  const types = Object.values(registry.documents)
    .filter((def) => def.source === "cms")
    .map((def) => {
      const drafts = store.all("draft", def.name);
      const published = store.all("published", def.name);
      const publishedVersions = new Map(published.map((row) => [row.id, row.version]));
      const changed = drafts.filter((row) => (publishedVersions.get(row.id) ?? -1) < row.version).length;
      const invalid = drafts.filter((row) => !validateDocument(def, row.data, registry).ok).length;
      return { def, drafts: drafts.length, published: published.length, changed, invalid };
    });

  const gitTypes = Object.values(registry.documents).filter((def) => def.source === "git");

  return (
    <>
      <p className="eyebrow">Content</p>
      <h1>Everything the CMS owns</h1>
      <p style={{ maxWidth: "62ch", color: "var(--ink-soft)" }}>
        Types are declared in <code>schema/</code>. This page is generated from that
        declaration, so a new type appears here with no studio change at all.
      </p>

      <div className="typegrid">
        {types.map(({ def, drafts, published, changed, invalid }) => (
          <Link className="typecard" key={def.name} href={`/studio/${def.name}`}>
            <h3>{def.label}</h3>
            <p className="counts">
              <span>{published} published</span>
              <span>{drafts} draft{drafts === 1 ? "" : "s"}</span>
              {changed > 0 ? <span className="chip chip-draft">{changed} changed</span> : null}
              {invalid > 0 ? <span className="chip chip-fail">{invalid} invalid</span> : null}
            </p>
          </Link>
        ))}
      </div>

      <h2>Owned by git</h2>
      <p style={{ maxWidth: "62ch", color: "var(--ink-soft)" }}>
        These are files in <code>content/</code>, reviewed in a pull request. The studio
        can reference them but never writes them — that is the boundary the whole design
        turns on.
      </p>
      <div className="typegrid">
        {gitTypes.map((def) => (
          <div className="typecard" key={def.name}>
            <h3>{def.label}</h3>
            <p className="counts"><span className="chip chip-git">git</span><span>read-only here</span></p>
          </div>
        ))}
      </div>
    </>
  );
}
