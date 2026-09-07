// Shared write path for the API and the CLI: validate, derive the route, extract refs,
// then hand it to the store. Nothing writes to the store without coming through here.

import { randomUUID } from "node:crypto";
import { extractRefs, routeFor, validateDocument, type Violation } from "@imprint/schema";
import type { SaveInput, Store, StoredDocument } from "@imprint/store";
import { registry } from "~/schema";

export interface WriteResult {
  ok: boolean;
  document?: StoredDocument;
  violations?: Violation[];
}

export function newId(): string {
  return randomUUID();
}

/**
 * Validate against the type's own schema, derive the route from its template, extract
 * refs for the inbound index, and save as a draft.
 */
export function writeDraft(
  store: Store,
  input: { id?: string; type: string; data: Record<string, unknown>; by: string; expectedVersion?: number }
): WriteResult {
  const def = registry.documents[input.type];
  if (!def) return { ok: false, violations: [{ path: "", message: `unknown type '${input.type}'` }] };

  const result = validateDocument(def, input.data, registry);
  if (!result.ok) return { ok: false, violations: result.violations };

  let route: string | null = null;
  try {
    route = routeFor(def, input.data);
  } catch (error) {
    return { ok: false, violations: [{ path: "", message: (error as Error).message }] };
  }

  const save: SaveInput = {
    id: input.id ?? newId(),
    type: input.type,
    route,
    data: input.data,
    schemaVer: def.schemaVersion,
    updatedBy: input.by,
    refs: extractRefs(def.fields, input.data, registry),
  };
  if (input.expectedVersion !== undefined) save.expectedVersion = input.expectedVersion;

  return { ok: true, document: store.save(save) };
}

/** A document plus the violations the CURRENT schema finds in it. */
export function withViolations(document: StoredDocument): StoredDocument & { violations: Violation[] } {
  const def = registry.documents[document.type];
  const violations = def ? validateDocument(def, document.data, registry).violations : [];
  return { ...document, violations };
}
