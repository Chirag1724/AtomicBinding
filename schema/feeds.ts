// Feeds: named, SHAPED sources a block can bind to.
//
// The declared item shape is what makes a binding path checkable. Without it,
// `integrations.results.0.logo.absolutePath` is a string nobody validates.

import { defineFeed, s } from "@imprint/schema";

/** What an integration record exposes, at flat dotted paths. */
export const integrationItem = {
  title: s.text(),
  summary: s.text(),
  route: s.route(),
  "logo.path": s.imagePath(),
  "logo.absolutePath": s.imageUrl(),
  "logo.alt": s.text(),
  updatedAt: s.displayDate(),
} as const;

export const releaseItem = {
  title: s.text(),
  version: s.text(),
  route: s.route(),
  releasedAt: s.displayDate(),
  summary: s.text(),
} as const;

export const changelogItem = {
  title: s.text(),
  route: s.route(),
  summary: s.text(),
  publishedAt: s.displayDate(),
} as const;

export const docsItem = {
  title: s.text(),
  route: s.route(),
  summary: s.text(),
  version: s.text(),
} as const;

export const integrations = defineFeed({
  name: "integrations",
  label: "All integrations",
  container: "results",
  item: integrationItem,
  query: true,
  select: { type: "integration", sort: "title", direction: "asc" },
});

export const releases = defineFeed({
  name: "releases",
  label: "Recent releases",
  container: "results",
  item: releaseItem,
  query: true,
  select: { type: "release", sort: "releasedAt", direction: "desc", limit: 10 },
});

export const changelog = defineFeed({
  name: "changelog",
  label: "Changelog",
  container: "results",
  item: changelogItem,
  query: true,
  select: { type: "changelogEntry", sort: "publishedAt", direction: "desc", limit: 20 },
});

export const docsPages = defineFeed({
  name: "docsPages",
  label: "Docs pages",
  container: "results",
  item: docsItem,
  query: true,
  select: { type: "docsPage", sort: "title", direction: "asc" },
});

export const FEEDS = { integrations, releases, changelog, docsPages };
