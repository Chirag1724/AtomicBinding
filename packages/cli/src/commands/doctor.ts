// `imprint doctor` — the state of the content, in one screen.

import { buildGraph, cmsAdapter, fsAdapter, runGates } from "@imprint/graph";
import { validateDocument } from "@imprint/schema";
import { openSqliteStore } from "@imprint/store";
import { migrationsFor } from "../../../../migrations/index";
import { registry } from "~/schema";
import { amber, bold, dim, green, heading, red, rule } from "../format";

export async function doctor(): Promise<number> {
  const store = openSqliteStore(process.env.IMPRINT_SQLITE_PATH ?? "./data/imprint.db");
  const graph = await buildGraph({
    adapters: [fsAdapter(), cmsAdapter(store, registry)],
    registry,
    variant: "published",
    root: process.cwd(),
  });

  heading("Sources");
  rule();
  const bySource = new Map<string, number>();
  for (const node of graph.nodes) bySource.set(node.source, (bySource.get(node.source) ?? 0) + 1);
  for (const [source, count] of bySource) {
    console.log(`  ${source.padEnd(6)} ${String(count).padStart(4)} nodes`);
  }
  console.log(`  ${dim("routes")} ${String(graph.byRoute.size).padStart(4)} distinct`);

  heading("Types");
  rule();
  console.log(dim(`  ${"type".padEnd(18)} ${"src".padEnd(5)} ${"pub".padStart(4)} ${"draft".padStart(6)} ${"behind".padStart(7)} ${"invalid".padStart(8)}`));
  for (const def of Object.values(registry.documents)) {
    const drafts = def.source === "cms" ? store.all("draft", def.name) : [];
    const published = def.source === "cms"
      ? store.all("published", def.name).length
      : graph.nodes.filter((node) => node.type === def.name).length;

    const behind = drafts.filter((row) => row.schemaVer < def.schemaVersion).length;
    const invalid = drafts.filter((row) => !validateDocument(def, row.data, registry).ok).length;

    console.log(
      `  ${def.name.padEnd(18)} ${def.source.padEnd(5)} ${String(published).padStart(4)} ` +
      `${String(drafts.length).padStart(6)} ` +
      `${behind ? amber(String(behind).padStart(7)) : dim("-".padStart(7))} ` +
      `${invalid ? red(String(invalid).padStart(8)) : dim("-".padStart(8))}`
    );
  }

  heading("Pending migrations");
  rule();
  let pending = 0;
  for (const def of Object.values(registry.documents)) {
    if (def.source !== "cms") continue;
    for (const row of store.all("draft", def.name)) {
      const chain = migrationsFor(def.name, row.schemaVer);
      if (!chain.length) continue;
      pending += 1;
      console.log(`  ${amber("*")} ${def.name} ${row.id.slice(0, 8)} v${row.schemaVer} -> v${chain[chain.length - 1]!.to}`);
      for (const step of chain) console.log(dim(`      ${step.describe()}`));
    }
  }
  if (!pending) console.log(dim("  nothing to migrate"));

  const report = runGates(graph, registry);
  heading("Gates");
  rule();
  console.log(report.ok
    ? green("  all six pass")
    : red(`  ${report.findings.length} finding(s) - run \`npm run gates\` for detail`));

  console.log();
  console.log(report.ok && !pending ? bold(green("  Healthy.")) : bold(amber("  Needs attention.")));
  console.log();

  store.close();
  return 0;
}
