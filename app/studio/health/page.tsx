// Schema health, and the gates.
//
// Validate-on-read means an invalid document is SERVED with its violations rather than
// lost. This page is what turns that into a list someone can work through.

import Link from "next/link";
import { runGates } from "@imprint/graph";
import { validateDocument } from "@imprint/schema";
import { openStore } from "@imprint/store";
import { siteGraph } from "@/lib/graph";
import { registry } from "~/schema";

export const dynamic = "force-dynamic";

export default async function Health() {
  const store = openStore();
  const graph = await siteGraph("published");
  const report = runGates(graph, registry);

  const failing = Object.values(registry.documents)
    .filter((def) => def.source === "cms")
    .flatMap((def) =>
      store.all("draft", def.name)
        .map((row) => ({ def, row, result: validateDocument(def, row.data, registry) }))
        .filter((entry) => !entry.result.ok || entry.row.schemaVer < def.schemaVersion)
    );

  return (
    <>
      <p className="eyebrow">Schema health</p>
      <h1>What is wrong, and where</h1>

      <h2 style={{ marginTop: 28 }}>Build gates</h2>
      <p className="muted" style={{ marginBottom: 14 }}>
        The same six checks the CLI runs in CI, against the published graph.
      </p>

      {report.findings.length === 0 ? (
        <p className="allclear">All six gates pass on {graph.nodes.length} nodes.</p>
      ) : (
        report.findings.map((finding, index) => (
          <div className={`finding${finding.severity === "warning" ? " warn" : ""}`} key={index}>
            <span className="gate">{finding.gate}</span>
            <p>{finding.message}</p>
            <p className="where">
              {finding.where.source}:{finding.where.id}
              {finding.where.path ? ` · ${finding.where.path}` : ""}
            </p>
          </div>
        ))
      )}

      <h2 style={{ marginTop: 34 }}>Documents against the current schema</h2>
      {failing.length === 0 ? (
        <p className="allclear">Every stored document satisfies the schema it is written against.</p>
      ) : (
        <div className="tablewrap">
          <table className="docs">
            <thead>
              <tr><th>Type</th><th>Document</th><th>Written against</th><th>Violations</th></tr>
            </thead>
            <tbody>
              {failing.map(({ def, row, result }) => (
                <tr key={row.id}>
                  <td>{def.label}</td>
                  <td>
                    <Link href={`/studio/${def.name}/${row.id}`}>
                      {String(row.data[def.titleField] ?? row.id)}
                    </Link>
                  </td>
                  <td className="muted">
                    v{row.schemaVer} {row.schemaVer < def.schemaVersion ? `(schema is v${def.schemaVersion})` : ""}
                  </td>
                  <td className="muted">
                    {result.violations.map((v) => `${v.path || "(document)"}: ${v.message}`).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
