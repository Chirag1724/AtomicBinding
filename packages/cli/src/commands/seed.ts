// `imprint seed` — real content, so the site and the studio have something to show.
//
// Everything here goes through the same write path the API uses: validated against the
// schema, route derived from the template, refs extracted for the inbound index.

import { randomUUID } from "node:crypto";
import { extractRefs, routeFor, validateDocument } from "@imprint/schema";
import { openSqliteStore, type Store } from "@imprint/store";
import { registry } from "~/schema";
import { amber, bold, dim, green, heading, red, rule } from "../format";

const BY = "seed";

/** A tiny inline logo, so seeding needs no network and no media provider. */
const logo = (label: string, colour: string) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="12" fill="${colour}"/>` +
    `<text x="32" y="41" font-family="monospace" font-size="26" fill="#fff" ` +
    `text-anchor="middle">${label}</text></svg>`;
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return { id: `logo-${label.toLowerCase()}`, alt: `${label} logo`, path: uri, absolutePath: uri };
};

const para = (...paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

let keySeed = 0;
const key = () => `s${(keySeed += 1).toString(36)}`;

interface Written { id: string; route: string | null }

function write(store: Store, type: string, data: Record<string, unknown>, publish = true): Written {
  const def = registry.document(type);
  const check = validateDocument(def, data, registry);
  if (!check.ok) {
    console.log(red(`  x ${type}: ${check.violations.map((v) => `${v.path} ${v.message}`).join(", ")}`));
    throw new Error(`seed data for '${type}' does not satisfy its own schema`);
  }

  const id = randomUUID();
  const route = routeFor(def, data);
  store.save({
    id, type, route, data,
    schemaVer: def.schemaVersion,
    updatedBy: BY,
    refs: extractRefs(def.fields, data, registry),
  });
  if (publish) store.publish(id, BY);
  console.log(`  ${green("+")} ${type.padEnd(16)} ${dim(route ?? "(no route)")}`);
  return { id, route };
}

export async function seed(argv: string[]): Promise<number> {
  const store = openSqliteStore(process.env.IMPRINT_SQLITE_PATH ?? "./data/imprint.db");
  const reset = argv.includes("--reset");
  const legacy = argv.includes("--legacy");

  if (reset) {
    for (const def of Object.values(registry.documents)) {
      for (const row of store.all("draft", def.name)) store.remove(row.id);
    }
    console.log(dim("  cleared every existing document\n"));
  }

  const existing = Object.values(registry.documents)
    .filter((def) => def.source === "cms")
    .reduce((sum, def) => sum + store.all("draft", def.name).length, 0);

  if (existing > 0 && !reset) {
    console.log(amber(`\n  ${existing} document(s) already exist. Re-run with --reset to start clean.\n`));
    store.close();
    return 0;
  }

  heading("Seeding");
  rule();

  // ── taxonomy ──────────────────────────────────────────────────────────────
  const payments = write(store, "category", {
    name: "Payments", slug: "payments", summary: "Move money, and know that you did.",
  });
  const messaging = write(store, "category", {
    name: "Messaging", slug: "messaging", summary: "Reach people where they already are.",
  });
  const analytics = write(store, "category", {
    name: "Analytics", slug: "analytics", summary: "Understand what happened, and when.",
  });

  const popular = write(store, "tag", { name: "Popular", slug: "popular" });
  const beta = write(store, "tag", { name: "Beta", slug: "beta" });

  // ── changelog and releases ────────────────────────────────────────────────
  const signing = write(store, "changelogEntry", {
    title: "Webhook signatures now cover the raw body",
    slug: "webhook-signatures-raw-body",
    publishedAt: "2026-08-27T09:00:00.000Z",
    kind: "changed",
    summary: "v1 normalised the JSON before signing. v2 signs the bytes we sent.",
    // CROSS-SOURCE: a CMS row referencing a git-owned page, by route.
    docsEntry: { _ref: "/docs/v2/webhooks", _source: "git" },
    body: [{
      _type: "richTextBlock", _key: key(),
      body: para(
        "Two byte-identical payloads could previously produce different signatures, " +
        "because normalisation ran before signing. It no longer does.",
        "Verify against the raw request body. A JSON round trip changes the bytes."
      ),
    }],
  });

  const errorCodes = write(store, "changelogEntry", {
    title: "Every error now carries a stable code",
    slug: "stable-error-codes",
    publishedAt: "2026-07-30T09:00:00.000Z",
    kind: "added",
    summary: "The message is for a person and may change. The code will not.",
    docsEntry: { _ref: "/docs/v2/errors", _source: "git" },
    body: [{
      _type: "richTextBlock", _key: key(),
      body: para("Switch on the code, never on the message."),
    }],
  });

  const release = write(store, "release", {
    title: "2.4.0",
    version: "2-4-0",
    releasedAt: "2026-08-27T09:00:00.000Z",
    summary: "Signing changes, stable error codes, and a faster webhook retry schedule.",
    notes: para("The signing change is not backwards compatible with v1 verifiers."),
    changes: [
      { _ref: signing.id, _source: "cms" },
      { _ref: errorCodes.id, _source: "cms" },
    ],
    // CROSS-SOURCE: which docs pages this release changed.
    affects: [
      { _ref: "/docs/v2/webhooks", _source: "git" },
      { _ref: "/docs/v2/errors", _source: "git" },
    ],
  });

  // ── integrations ──────────────────────────────────────────────────────────
  write(store, "integration", {
    name: "Stripe", slug: "stripe",
    summary: "Take payments and reconcile them against your own ledger.",
    logo: logo("St", "#635bff"),
    category: { _ref: payments.id, _source: "cms" },
    tags: [{ _ref: popular.id, _source: "cms" }],
    docsEntry: { _ref: "/docs/v2/webhooks", _source: "git" },
    minRelease: { _ref: release.id, _source: "cms" },
    body: [{
      _type: "callout", _key: key(), tone: "note", title: "Webhooks are required",
      body: para("Stripe events arrive as webhooks, so set signature verification up first."),
    }],
  });

  write(store, "integration", {
    name: "Slack", slug: "slack",
    summary: "Post events into a channel your team already reads.",
    logo: logo("Sl", "#4a154b"),
    category: { _ref: messaging.id, _source: "cms" },
    tags: [{ _ref: popular.id, _source: "cms" }],
    docsEntry: { _ref: "/docs/v2/quickstart", _source: "git" },
    body: [],
  });

  write(store, "integration", {
    name: "Segment", slug: "segment",
    summary: "Fan events out to every analytics tool without writing each one.",
    logo: logo("Se", "#52bd95"),
    category: { _ref: analytics.id, _source: "cms" },
    tags: [{ _ref: beta.id, _source: "cms" }],
    body: [],
  });

  // ── marketing pages ───────────────────────────────────────────────────────
  const home = write(store, "marketingPage", {
    title: "One graph over two authoring surfaces",
    slug: "home",
    summary: "Docs in git, everything else in a CMS we built. Nothing downstream knows the difference.",
    body: [
      {
        _type: "hero", _key: key(),
        heading: "Docs in git. Everything else in a CMS.",
        subheading:
          "Engineers write markdown beside the code and review it in the same pull request. " +
          "Marketers compose pages and publish without a deploy. One typed graph over both.",
        primaryAction: { label: "Read the docs", href: "/docs" },
        secondaryAction: { label: "Open the studio", href: "/studio" },
        align: "left",
      },
      {
        _type: "featureGrid", _key: key(),
        heading: "What the schema language buys",
        columns: "3",
        features: [
          {
            title: "One definition, five consumers",
            body: "Storage validation, the editor form, the delivery API, the render props, and the gates. No codegen, so nothing drifts.",
          },
          {
            title: "Bindings that cannot be wrong",
            body: "A binding path is checked against the feed's declared shape and the block's props. A typo is a type error, not an empty card.",
          },
          {
            title: "References across the boundary",
            body: "A CMS row can reference a git-owned page by route, and the build tells you the moment that page moves.",
          },
        ],
      },
      {
        _type: "integrationGrid", _key: key(),
        heading: "Integrations",
        columns: "3",
        // Bound to the `integrations` feed. The rows below are compiled from the schema.
        _binding: registry.block("integrationGrid").rows,
      },
      {
        _type: "ctaSection", _key: key(),
        heading: "Every route belongs to exactly one source",
        body: "Moving a page between git and the CMS is an edit to the ownership manifest and a content move. No route code changes.",
        action: { label: "See the changelog", href: "/changelog" },
        tone: "loud",
      },
    ],
  });

  write(store, "marketingPage", {
    title: "Pricing", slug: "pricing",
    summary: "What it costs, with no per-seat surprise.",
    body: [
      { _type: "hero", _key: key(), heading: "Pricing", subheading: "Two plans. No per-seat pricing.", align: "centre" },
      {
        _type: "faq", _key: key(),
        heading: "Before you ask",
        items: [
          { question: "Is there a per-seat charge?", answer: para("No. Add as many editors as you need.") },
          { question: "What happens when I exceed the plan?", answer: para("We tell you. Nothing stops serving.") },
        ],
      },
    ],
  });

  write(store, "marketingPage", {
    title: "Changelog", slug: "changelog",
    summary: "What changed, and which docs pages it changed.",
    body: [{
      _type: "richTextBlock", _key: key(),
      body: para(
        "Every release names the docs pages it affects. Those references are checked at " +
        "build time, so a moved page fails the build rather than rotting quietly."
      ),
    }],
  });

  write(store, "marketingPage", {
    title: "Integrations", slug: "integrations",
    summary: "Everything that plugs in.",
    body: [{
      _type: "integrationGrid", _key: key(),
      heading: "All integrations",
      columns: "3",
      _binding: registry.block("integrationGrid").rows,
    }],
  });

  // ── singletons ────────────────────────────────────────────────────────────
  write(store, "navigation", {
    label: "Main navigation",
    items: [
      { label: "Docs", target: { label: "Docs", href: "/docs" } },
      { label: "Blog", target: { label: "Blog", href: "/blog" } },
      { label: "Integrations", target: { label: "Integrations", href: "/integrations" } },
      { label: "Changelog", target: { label: "Changelog", href: "/changelog" } },
      { label: "Pricing", target: { label: "Pricing", href: "/pricing" } },
    ],
  });

  write(store, "siteSettings", {
    siteName: "Imprint",
    tagline: "Docs in git, everything else in a CMS.",
    footerNote: "Two authoring surfaces, one typed graph, six gates between them and production.",
    homePage: { _ref: home.id, _source: "cms" },
  });

  // ── the migration demo ────────────────────────────────────────────────────
  if (legacy) {
    // Written the way an OLDER version of the code wrote it: `blurb`, schema v1. It goes
    // in behind the validator on purpose — that is what a stale row actually is.
    const id = randomUUID();
    store.save({
      id, type: "integration", route: "/integrations/twilio",
      data: {
        name: "Twilio", slug: "twilio",
        blurb: "Send messages people actually receive.",
        logo: logo("Tw", "#f22f46"),
        category: { _ref: messaging.id, _source: "cms" },
        body: [],
      },
      schemaVer: 1,
      updatedBy: "legacy-import",
    });
    console.log(`  ${amber("!")} ${"integration".padEnd(16)} ${dim("/integrations/twilio (schema v1, uses `blurb`)")}`);
  }

  console.log();
  console.log(green(bold("  Seeded.")));
  console.log(dim("  npm run dev     the site and the studio on http://localhost:3100"));
  console.log(dim("  npm run gates   the six build gates"));
  if (legacy) console.log(dim("  npm run migrate the legacy row, dry run first"));
  console.log();

  store.close();
  return 0;
}
