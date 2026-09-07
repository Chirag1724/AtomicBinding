// Marketing blocks. CMS-only: there is no reason to author a pricing table in a
// markdown file, and offering it there means maintaining a second authoring path.

import { defineBlock, f } from "@imprint/schema";

export const hero = defineBlock({
  name: "hero",
  label: "Hero",
  preview: (v) => v.heading as string,
  fields: {
    heading: f.text({ required: true, max: 90 }),
    subheading: f.textArea({ max: 220 }),
    primaryAction: f.link({ help: "The one thing you want them to do." }),
    secondaryAction: f.link(),
    image: f.image({ mime: ["image/svg+xml", "image/png", "image/webp"] }),
    align: f.select({ options: ["left", "centre"], default: "left" }),
  },
});

export const featureGrid = defineBlock({
  name: "featureGrid",
  label: "Feature grid",
  preview: (v) => `${(v.features as unknown[] | undefined)?.length ?? 0} features`,
  fields: {
    heading: f.text({ max: 90 }),
    columns: f.select({ options: ["2", "3"], default: "3" }),
    features: f.objectList({
      required: true,
      minCount: 2,
      maxCount: 9,
      fields: {
        title: f.text({ required: true, max: 60 }),
        body: f.textArea({ required: true, max: 200 }),
        href: f.link(),
      },
    }),
  },
});

export const faq = defineBlock({
  name: "faq",
  label: "FAQ",
  preview: (v) => `${(v.items as unknown[] | undefined)?.length ?? 0} questions`,
  fields: {
    heading: f.text({ max: 90, default: "Frequently asked" }),
    items: f.objectList({
      required: true,
      minCount: 1,
      fields: {
        question: f.text({ required: true, max: 140 }),
        answer: f.richText({ required: true }),
      },
    }),
  },
});

export const ctaSection = defineBlock({
  name: "ctaSection",
  label: "Call to action",
  preview: (v) => v.heading as string,
  fields: {
    heading: f.text({ required: true, max: 90 }),
    body: f.textArea({ max: 200 }),
    action: f.link({ required: true }),
    tone: f.select({ options: ["quiet", "loud"], default: "quiet" }),
  },
});

export const logoWall = defineBlock({
  name: "logoWall",
  label: "Logo wall",
  preview: (v) => `${(v.logos as unknown[] | undefined)?.length ?? 0} logos`,
  fields: {
    heading: f.text({ max: 90 }),
    logos: f.objectList({
      required: true,
      minCount: 1,
      fields: {
        name: f.text({ required: true, max: 60 }),
        image: f.image({ required: true, mime: ["image/svg+xml", "image/png"] }),
      },
    }),
  },
});
