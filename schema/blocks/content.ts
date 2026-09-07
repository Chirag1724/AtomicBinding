// Blocks authorable on BOTH surfaces. A `:::callout{...}` directive in a markdown file
// and a callout added in the studio produce the same block instance.

import { defineBlock, f } from "@imprint/schema";

export const richTextBlock = defineBlock({
  name: "richTextBlock",
  label: "Rich text",
  surfaces: ["mdx", "cms"],
  preview: (v) => {
    const doc = v.body as { content?: { content?: { text?: string }[] }[] } | undefined;
    return doc?.content?.[0]?.content?.[0]?.text?.slice(0, 60);
  },
  fields: {
    body: f.richText({ required: true, marks: ["bold", "italic", "code", "link"] }),
  },
});

export const callout = defineBlock({
  name: "callout",
  label: "Callout",
  surfaces: ["mdx", "cms"],
  preview: (v) => (v.title as string) ?? (v.tone as string),
  fields: {
    tone: f.select({ options: ["note", "warning", "deprecated"], default: "note", required: true }),
    title: f.text({ max: 80 }),
    body: f.richText({ required: true }),
  },
});

export const codeBlock = defineBlock({
  name: "codeBlock",
  label: "Code",
  surfaces: ["mdx", "cms"],
  preview: (v) => `${v.language as string} · ${String(v.code ?? "").split("\n").length} lines`,
  fields: {
    language: f.text({ required: true, max: 20 }),
    code: f.textArea({ required: true, rows: 12 }),
    filename: f.text({ max: 80, help: "Shown as a tab label above the code." }),
  },
});
