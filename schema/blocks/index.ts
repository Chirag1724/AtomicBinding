export { richTextBlock, callout, codeBlock } from "./content";
export { hero, featureGrid, faq, ctaSection, logoWall } from "./marketing";
export { integrationGrid } from "./integrationGrid";

import { richTextBlock, callout, codeBlock } from "./content";
import { hero, featureGrid, faq, ctaSection, logoWall } from "./marketing";
import { integrationGrid } from "./integrationGrid";

export const ALL_BLOCKS = [
  hero, richTextBlock, callout, codeBlock, featureGrid,
  faq, ctaSection, logoWall, integrationGrid,
];

/** What a docs or blog page may hold — the both-surfaces set. */
export const PROSE_BLOCKS = ["richTextBlock", "callout", "codeBlock"];

/** What a marketing page may hold. */
export const PAGE_BLOCKS = [
  "hero", "richTextBlock", "featureGrid", "faq", "ctaSection", "logoWall", "integrationGrid", "callout",
];
