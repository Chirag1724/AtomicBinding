// The block that carries the binding thesis.
//
// It holds NO card content of its own. Its cards come from a feed, through a binding
// whose every path is checked against the feed's declared item shape and whose every
// target is checked against the card shape below.
//
// Try breaking it — both of these fail to compile:
//
//   image: (i) => i.logo.path         // ImagePath is not assignable to ImageUrl
//   title: (i) => i.headline          // feed 'integrations' declares no path 'headline'

import { bind, defineBlock, f } from "@imprint/schema";
import { integrationCard } from "../cards";
import { integrations } from "../feeds";

export const integrationGrid = defineBlock({
  name: "integrationGrid",
  label: "Integration grid",
  preview: (v) => (v.heading as string) ?? "Integrations",
  card: integrationCard,
  fields: {
    heading: f.text({ max: 90, default: "Integrations" }),
    columns: f.select({ options: ["2", "3", "4"], default: "3" }),
    max: f.number({ integer: true, min: 1, max: 24, help: "Cards to show. Blank shows all." }),
  },
  // `replicate()` describes card 0 only; the resolver applies it to every item the feed
  // returned. You write the design once and it holds for n cards.
  binding: bind(integrations, integrationCard)
    .replicate()
    .map({
      title: (i) => i.title,
      summary: (i) => i.summary,
      image: (i) => i.logo.absolutePath,
      href: (i) => i.route,
    }),
});
