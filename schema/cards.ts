// Card shapes: the props a list block's items receive.
//
// Declared separately from the block so several blocks can share one, and so a binding
// has something to type-check its targets against.

import { p } from "@imprint/schema";

export const linkCard = {
  title: p.text({ required: true }),
  summary: p.text(),
  href: p.route({ required: true }),
} as const;

export const integrationCard = {
  title: p.text({ required: true }),
  summary: p.text(),
  /** Fully qualified — the grid renders through an image CDN. Binding `logo.path`
   *  here is a type error, which is the entire point. */
  image: p.imageUrl(),
  href: p.route({ required: true }),
} as const;

export const releaseCard = {
  title: p.text({ required: true }),
  version: p.text(),
  released: p.displayDate(),
  href: p.route({ required: true }),
} as const;
