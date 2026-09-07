// Validate on READ, not only on write.
//
// A document written against an older schema must not crash the site. It comes back with
// a `violations[]` array and is surfaced in Schema Health, where an admin can migrate it.

import type { AnyBlock, AnyDocument, Registry } from "./defs";
import type { AnyField, FieldMap } from "./types";
import type { BlockInstance, Ref } from "./values";

export interface Violation {
  /** Dotted path into the document's data, e.g. "body[2].tone". */
  path: string;
  message: string;
  expected?: string;
  actual?: string;
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
}

function fromZod(error: { issues: { path: (string | number)[]; message: string; code: string }[] }): Violation[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((p) => (typeof p === "number" ? `[${p}]` : p)).join(".").replace(/\.\[/g, "["),
    message: issue.message,
    expected: issue.code,
  }));
}

/** One document against its own type, including every block it holds. */
export function validateDocument(
  def: AnyDocument,
  data: unknown,
  registry?: Registry
): ValidationResult {
  const parsed = def.zod.safeParse(data);
  const violations: Violation[] = parsed.success ? [] : fromZod(parsed.error);

  if (registry && data && typeof data === "object") {
    for (const [name, field] of Object.entries(def.fields)) {
      if (field.kind !== "blocks") continue;
      const value = (data as Record<string, unknown>)[name];
      if (!Array.isArray(value)) continue;
      violations.push(...validateBlockList(value as BlockInstance[], name, field.allow, registry));
    }
  }

  return { ok: violations.length === 0, violations };
}

function validateBlockList(
  blocks: BlockInstance[],
  fieldName: string,
  allow: string[],
  registry: Registry
): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();

  blocks.forEach((instance, index) => {
    const at = `${fieldName}[${index}]`;

    if (!instance._key) {
      violations.push({ path: at, message: "block has no _key" });
    } else if (seen.has(instance._key)) {
      violations.push({ path: at, message: `duplicate _key '${instance._key}'` });
    } else {
      seen.add(instance._key);
    }

    if (!allow.includes(instance._type)) {
      violations.push({
        path: `${at}._type`,
        message: `'${instance._type}' is not allowed here`,
        expected: allow.join(" | "),
        actual: instance._type,
      });
      return;
    }

    let block: AnyBlock;
    try {
      block = registry.block(instance._type);
    } catch {
      violations.push({
        path: `${at}._type`,
        message: `no block type '${instance._type}' is registered — a document still names it`,
      });
      return;
    }

    const { _type, _key, ...fields } = instance;
    const parsed = block.zod.safeParse(fields);
    if (!parsed.success) {
      violations.push(
        ...fromZod(parsed.error).map((v) => ({ ...v, path: `${at}.${v.path}` }))
      );
    }
  });

  return violations;
}

// ── Extraction: refs and links ──────────────────────────────────────────────────

export interface ExtractedRef extends Ref {
  path: string;
  /** The document type the field points at. */
  to: string;
}

/** Every reference a document holds, with the field path that held it.
 *  Written to `data.refs` on save so "what points at X" is an index lookup. */
export function extractRefs(fields: FieldMap, data: unknown, registry?: Registry): ExtractedRef[] {
  const found: ExtractedRef[] = [];

  const walk = (map: FieldMap, value: unknown, prefix: string) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;

    for (const [name, field] of Object.entries(map)) {
      const at = prefix ? `${prefix}.${name}` : name;
      const held = record[name];
      if (held === undefined || held === null) continue;

      switch (field.kind) {
        case "reference":
          found.push({ ...(held as Ref), path: at, to: field.to });
          break;
        case "referenceList":
          (held as Ref[]).forEach((ref, index) => {
            found.push({ ...ref, path: `${at}[${index}]`, to: field.to });
          });
          break;
        case "object":
          walk(field.fields, held, at);
          break;
        case "objectList":
          (held as unknown[]).forEach((item, index) => walk(field.fields, item, `${at}[${index}]`));
          break;
        case "blocks":
          if (!registry) break;
          (held as BlockInstance[]).forEach((instance, index) => {
            let block: AnyBlock;
            try { block = registry.block(instance._type); } catch { return; }
            walk(block.fields, instance, `${at}[${index}]`);
          });
          break;
        default:
          break;
      }
    }
  };

  walk(fields, data, "");
  return found;
}

/**
 * Internal links a document points at. Extracted from link fields and rich text —
 * never declared, because a declared link list is a second thing to keep in sync.
 */
export function extractLinks(data: unknown): string[] {
  const links = new Set<string>();

  const walk = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (typeof value !== "object") return;

    const record = value as Record<string, unknown>;

    // A link field.
    if (typeof record.href === "string" && record.href.startsWith("/")) links.add(record.href);

    // A rich-text link mark.
    if (Array.isArray(record.marks)) {
      for (const mark of record.marks as { type?: string; attrs?: Record<string, unknown> }[]) {
        const href = mark.attrs?.href;
        if (mark.type === "link" && typeof href === "string" && href.startsWith("/")) links.add(href);
      }
    }

    for (const nested of Object.values(record)) walk(nested);
  };

  walk(data);
  return [...links].sort();
}

/** Plain text for the search index, from every string a document holds. */
export function searchTextOf(data: unknown): string {
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") { parts.push(value); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(data);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
