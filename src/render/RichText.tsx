// Structured rich text -> elements. The stored shape is ours, so this is a switch over
// node types we defined, not a markdown parser guessing.

import Link from "next/link";
import type { RichTextDoc, RichTextNode } from "@imprint/schema";
import type { ReactNode } from "react";

function marked(node: RichTextNode, key: string): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong key={`${key}b`}>{out}</strong>;
    else if (mark.type === "italic") out = <em key={`${key}i`}>{out}</em>;
    else if (mark.type === "code") out = <code key={`${key}c`}>{out}</code>;
    else if (mark.type === "link") {
      const href = String(mark.attrs?.href ?? "#");
      out = href.startsWith("/")
        ? <Link key={`${key}l`} href={href}>{out}</Link>
        : <a key={`${key}l`} href={href} rel="noreferrer">{out}</a>;
    }
  }
  return out;
}

function render(nodes: RichTextNode[] | undefined, prefix: string): ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    const key = `${prefix}-${index}`;
    if (node.type === "text") return <span key={key}>{marked(node, key)}</span>;
    if (node.type === "paragraph") return <p key={key}>{render(node.content, key)}</p>;
    if (node.type === "heading") {
      const level = Number(node.attrs?.level ?? 2);
      const Tag = (level === 3 ? "h3" : "h2") as "h2" | "h3";
      return <Tag key={key}>{render(node.content, key)}</Tag>;
    }
    if (node.type === "bulletList") return <ul key={key}>{render(node.content, key)}</ul>;
    if (node.type === "listItem") return <li key={key}>{render(node.content, key)}</li>;
    return <span key={key}>{render(node.content, key)}</span>;
  });
}

export function RichText({ doc }: { doc: RichTextDoc | undefined }) {
  if (!doc?.content?.length) return null;
  return <div className="prose">{render(doc.content, "rt")}</div>;
}
