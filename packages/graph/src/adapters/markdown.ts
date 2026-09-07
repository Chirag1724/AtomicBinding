// Markdown -> the same structured rich text the CMS stores, plus block directives.
//
// The point is NOT to be a full markdown implementation. It is that a git-authored
// document ends up as the same node shape as a CMS one, blocks included, so the front
// end has one renderer rather than two.

import type { BlockInstance, RichTextDoc, RichTextNode } from "@imprint/schema";

let counter = 0;
/** Deterministic within a build, so a rebuild does not churn every _key. */
const keyFor = (seed: string): string => `${seed}-${(counter += 1).toString(36)}`;

export function resetKeys(): void {
  counter = 0;
}

const inline = (text: string): RichTextNode[] => {
  const nodes: RichTextNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push({ type: "text", text: text.slice(cursor, match.index) });
    if (match[2]) {
      nodes.push({
        type: "text",
        text: match[2],
        marks: [{ type: "link", attrs: { href: match[3]! } }],
      });
    } else if (match[5]) {
      nodes.push({ type: "text", text: match[5], marks: [{ type: "code" }] });
    } else if (match[7]) {
      nodes.push({ type: "text", text: match[7], marks: [{ type: "bold" }] });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push({ type: "text", text: text.slice(cursor) });
  return nodes.length ? nodes : [{ type: "text", text }];
};

/** `{tone=warning title="Heads up"}` -> an attribute record. */
function readAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /(\w+)=(?:"([^"]*)"|'([^']*)'|([^\s}]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    attrs[match[1]!] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function paragraphsToDoc(chunk: string): RichTextDoc {
  const content: RichTextNode[] = [];
  for (const paragraph of chunk.split(/\n{2,}/)) {
    const text = paragraph.trim();
    if (text) content.push({ type: "paragraph", content: inline(text) });
  }
  return { type: "doc", content };
}

/**
 * Splits a markdown body into blocks. Prose becomes `richTextBlock`; a `:::name{...}`
 * directive becomes an instance of that block type — which is why `surfaces` exists on
 * a block definition.
 */
export function markdownToBlocks(markdown: string, seed: string): BlockInstance[] {
  const blocks: BlockInstance[] = [];
  const lines = markdown.split("\n");
  let prose: string[] = [];

  const flushProse = () => {
    const text = prose.join("\n").trim();
    prose = [];
    if (!text) return;
    blocks.push({ _type: "richTextBlock", _key: keyFor(seed), body: paragraphsToDoc(text) });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;

    const open = /^:::(\w+)\s*(\{[^}]*\})?\s*$/.exec(line);
    if (open) {
      flushProse();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^:::\s*$/.test(lines[index]!)) {
        body.push(lines[index]!);
        index += 1;
      }
      const attrs = readAttrs(open[2] ?? "");
      blocks.push({
        _type: open[1]!,
        _key: keyFor(seed),
        ...attrs,
        body: paragraphsToDoc(body.join("\n")),
      });
      continue;
    }

    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      flushProse();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index]!)) {
        code.push(lines[index]!);
        index += 1;
      }
      blocks.push({
        _type: "codeBlock",
        _key: keyFor(seed),
        language: fence[1] || "text",
        code: code.join("\n"),
      });
      continue;
    }

    prose.push(line);
  }

  flushProse();
  return blocks;
}

/** Plain text of a rich-text doc, for summaries and the search index. */
export function plainText(doc: RichTextDoc | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (nodes: RichTextNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.text) parts.push(node.text);
      walk(node.content);
    }
  };
  walk(doc.content);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
