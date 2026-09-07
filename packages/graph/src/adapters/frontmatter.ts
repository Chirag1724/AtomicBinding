// A small frontmatter reader. Deliberately not a YAML engine: the docs frontmatter
// contract is scalars and flat lists, and a full parser invites nested structure that
// the schema would then have to validate anyway.

export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

const scalar = (raw: string): unknown => {
  const value = raw.trim();
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d*\.\d+$/.test(value)) return Number(value);
  if (/^\[.*\]$/.test(value)) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((part) => scalar(part));
  }
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) return value.slice(1, -1);
  return value;
};

export function readFrontmatter(text: string): Frontmatter {
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, body: normalized };

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return { data: {}, body: normalized };

  const head = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n/, "");
  const data: Record<string, unknown> = {};

  let listKey: string | null = null;
  for (const line of head.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) {
      (data[listKey] as unknown[]).push(scalar(item[1]!));
      continue;
    }

    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, raw] = pair;
    if (raw!.trim() === "") {
      listKey = key!;
      data[key!] = [];
    } else {
      listKey = null;
      data[key!] = scalar(raw!);
    }
  }

  return { data, body };
}
