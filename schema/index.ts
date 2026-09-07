// The content model for this site.
//
// Everything the platform knows about content is here. The store validates against it,
// the studio renders forms from it, the delivery API types itself from it, the site
// renders props from it, and the gates check all four still agree.

import { defineRegistry, type Ownership } from "@imprint/schema";
import { ALL_BLOCKS } from "./blocks/index";
import { FEEDS } from "./feeds";
import { blogPost, docsPage } from "./documents/git";
import {
  changelogEntry, integration, marketingPage, navigation, release, siteSettings,
} from "./documents/cms";
import { category, tag } from "./documents/taxonomy";

/**
 * URL prefix -> the ONE source allowed to claim routes under it.
 *
 * This is what makes a collision structurally impossible rather than merely caught:
 * moving /pricing from git to the CMS is an edit here plus a content move, and touches
 * no route code at all.
 */
export const OWNERSHIP: Ownership = {
  "/docs": "git",
  "/blog": "git",
  "/integrations": "cms",
  "/changelog": "cms",
  "/releases": "cms",
  "/": "cms",
};

/**
 * Routes the Next application serves itself. They belong to no adapter, so the graph
 * never claims them and the link gate treats them as valid destinations.
 */
export const APP_ROUTES = ["/studio", "/api"];

export const registry = defineRegistry({
  documents: [
    docsPage, blogPost,
    marketingPage, integration, release, changelogEntry,
    navigation, siteSettings,
    category, tag,
  ],
  blocks: ALL_BLOCKS,
  feeds: FEEDS,
  ownership: OWNERSHIP,
  appRoutes: APP_ROUTES,
});

export { FEEDS };
export * from "./blocks/index";
export * from "./cards";
export * from "./documents/git";
export * from "./documents/cms";
export * from "./documents/taxonomy";
