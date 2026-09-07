// `imprint gates` — the six build gates. Exit 1 when any of them fails.

import { buildGraph, cmsAdapter, fsAdapter, runGates, type GateId } from "@imprint/graph";
import { openSqliteStore } from "@imprint/store";
import { registry } from "~/schema";
import { amber, bold, dim, green, heading, red, rule } from "../format";

const LABELS: Record<GateId, string> = {
  "route-uniqueness": "Route uniqueness",
  "link-integrity": "Link integrity",
  "reference-resolution": "Reference resolution",
  "schema-validity": "Schema validity",
  "binding-validity": "Binding validity",
  "binding-round-trip": "Binding round-trip",
};

export async function gates(argv: string[]): Promise<number> {
  const variant = argv.includes("--draft") ? "draft" : "published";
  const store = openSqliteStore(process.env.IMPRINT_SQLITE_PATH ?? "./data/imprint.db");

  const graph = await buildGraph({
    adapters: [fsAdapter(), cmsAdapter(store, registry)],
    registry,
    variant,
    root: process.cwd(),
  });

  const report = runGates(graph, registry);

  heading(`Gates - ${graph.nodes.length} nodes - ${variant}`);
  rule();

  for (const [gate, label] of Object.entries(LABELS) as [GateId, string][]) {
    const count = report.counts[gate];
    const mark = count === 0 ? green("pass") : red("FAIL");
    console.log(`  ${mark}  ${label.padEnd(22)} ${count === 0 ? dim("-") : red(`${count} finding(s)`)}`);
  }

  if (report.findings.length) {
    heading("Findings");
    rule();
    for (const finding of report.findings) {
      const tag = finding.severity === "error" ? red("error") : amber("warn");
      console.log(`\n  ${tag} ${dim(finding.gate)}`);
      console.log(`  ${finding.message}`);
      console.log(
        dim(`  ${finding.where.source}:${finding.where.id}` +
          (finding.where.path ? ` - ${finding.where.path}` : ""))
      );
    }
  }

  console.log();
  console.log(report.ok
    ? green(`  ${bold("All six gates pass.")}`)
    : red(`  ${bold(`${report.findings.length} finding(s). This build should not ship.`)}`));
  console.log();

  store.close();
  return report.ok ? 0 : 1;
}
