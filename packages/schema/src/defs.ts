// The three kinds of schema object, plus the registry that indexes them.
//
// `defineDocument` returns the definition AND its zod schema AND its editor manifest.
// The component that renders a block imports the same file and types its props from it.
// There is no second declaration of a field anywhere in the system.

import { manifestFor, type ManifestField } from "./manifest";
import { zodFor } from "./zod";
import type { BindingDef, FeedDef, Row } from "./binding";
import { compile } from "./binding";
import type { CardShape } from "./props";
import type { FieldMap, Infer } from "./types";
import type { Source } from "./values";
import type { z, ZodTypeAny } from "zod";

export type Section = "docs" | "blog" | "marketing" | "integrations" | "changelog" | "legal";

// ── documentType ────────────────────────────────────────────────────────────────

export interface DocumentDef<F extends FieldMap = FieldMap> {
  kind: "document";
  name: string;
  label: string;
  /** Field whose value titles the document in lists and in resolved references. */
  titleField: keyof F & string;
  /** Templated route. Only field names in braces, e.g. "/integrations/{slug}". Omit
   *  for a document that is fetched by type rather than served at a URL. */
  route?: string;
  section: Section;
  /** Which surface owns it. `git` documents are files; `cms` documents are rows. */
  source: Source;
  /** Bumped when a field is renamed or its type changes. Additive changes need no bump. */
  schemaVersion: number;
  /** A singleton has exactly one instance and, by design, no route. */
  singleton?: boolean;
  fields: F;
  readonly zod: z.ZodObject<Record<string, ZodTypeAny>>;
  readonly manifest: ManifestField[];
  readonly _data?: Infer<F>;
}

export function defineDocument<const F extends FieldMap>(def: {
  name: string;
  label: string;
  titleField: keyof F & string;
  route?: string;
  section: Section;
  source?: Source;
  schemaVersion?: number;
  singleton?: boolean;
  fields: F;
}): DocumentDef<F> {
  const full = {
    kind: "document" as const,
    source: "cms" as Source,
    schemaVersion: 1,
    ...def,
  };
  if (full.singleton && full.route) {
    throw new Error(
      `${full.name}: a singleton has no route. A routable singleton invites accidental publishing.`
    );
  }
  return {
    ...full,
    zod: zodFor(def.fields),
    manifest: manifestFor(def.fields),
  };
}

/** The data type a document stores. */
export type Doc<D> = D extends { readonly _data?: infer T } ? T : never;

// ── blockType ───────────────────────────────────────────────────────────────────

export interface BlockDef<F extends FieldMap = FieldMap, C extends CardShape = CardShape> {
  kind: "block";
  name: string;
  label: string;
  /** Where this block may be authored. A block absent from a surface cannot be inserted there. */
  surfaces: ("mdx" | "cms")[];
  schemaVersion: number;
  /** Studio list label for one instance. Keep it cheap; it runs per row. */
  preview?: (value: Record<string, unknown>) => string | undefined;
  /** The card props this block's items receive, when it renders a list. */
  card?: C;
  /** What it binds the moment it is added, so it shows real content immediately. */
  binding?: BindingDef;
  /** Hidden from the palette but STILL RENDERED. Saved documents name blocks by name,
   *  so deleting one blanks every live page using it, with no build error to warn you. */
  deprecated?: boolean;
  fields: F;
  readonly zod: z.ZodObject<Record<string, ZodTypeAny>>;
  readonly manifest: ManifestField[];
  /** The binding's stored rows. Derived, never hand-written. */
  readonly rows: Row[];
  readonly _props?: Infer<F>;
}

export function defineBlock<const F extends FieldMap, const C extends CardShape = CardShape>(def: {
  name: string;
  label: string;
  surfaces?: ("mdx" | "cms")[];
  schemaVersion?: number;
  preview?: (value: Record<string, unknown>) => string | undefined;
  card?: C;
  binding?: BindingDef;
  deprecated?: boolean;
  fields: F;
}): BlockDef<F, C> {
  for (const [name, field] of Object.entries(def.fields)) {
    if (field.kind === "blocks") {
      throw new Error(
        `${def.name}.${name}: a block cannot hold a blocks field. Arbitrary nesting produces ` +
          `content nobody can find or edit; use object / objectList for repeatable groups.`
      );
    }
  }
  return {
    kind: "block",
    surfaces: ["cms"],
    schemaVersion: 1,
    ...def,
    zod: zodFor(def.fields),
    manifest: manifestFor(def.fields),
    rows: def.binding ? compile(def.binding) : [],
  };
}

/** The props a block's component receives for its own fields. */
export type Props<B> = B extends { readonly _props?: infer T } ? T : never;

// ── taxonomyType ────────────────────────────────────────────────────────────────

export interface TaxonomyDef<F extends FieldMap = FieldMap> extends Omit<DocumentDef<F>, "kind"> {
  kind: "taxonomy";
  /** 1 = flat, 2 = one level of nesting. Deeper is not offered on purpose. */
  depth: 1 | 2;
}

export function defineTaxonomy<const F extends FieldMap>(def: {
  name: string;
  label: string;
  titleField: keyof F & string;
  route?: string;
  depth?: 1 | 2;
  schemaVersion?: number;
  fields: F;
}): TaxonomyDef<F> {
  const document = defineDocument({ ...def, section: "marketing", source: "cms" });
  return { ...document, kind: "taxonomy", depth: def.depth ?? 1 };
}

// ── The registry ────────────────────────────────────────────────────────────────

export type AnyDocument = DocumentDef<FieldMap> | TaxonomyDef<FieldMap>;
export type AnyBlock = BlockDef<FieldMap, CardShape>;

/** URL prefix -> the ONE source allowed to claim routes under it. Collisions between
 *  sources become structurally impossible rather than merely caught. */
export type Ownership = Record<string, Source>;

export interface Registry {
  documents: Record<string, AnyDocument>;
  blocks: Record<string, AnyBlock>;
  feeds: Record<string, FeedDef>;
  ownership: Ownership;
  /** Prefixes the APPLICATION serves, owned by no adapter. Links to them are valid; the
   *  graph never claims them. Without this every page linking to /studio fails a gate. */
  appRoutes: string[];
  /** True when a route is served by the app rather than by content. */
  isAppRoute(route: string): boolean;
  document(name: string): AnyDocument;
  block(name: string): AnyBlock;
  feed(name: string): FeedDef;
  /** Blocks a `blocks` field may offer, minus deprecated ones. */
  offered(allow: string[], surface: "mdx" | "cms"): AnyBlock[];
  /** The source that owns a route, by longest matching prefix. */
  ownerOf(route: string): Source;
}

export function defineRegistry(input: {
  documents: AnyDocument[];
  blocks: AnyBlock[];
  feeds: Record<string, FeedDef>;
  ownership: Ownership;
  appRoutes?: string[];
}): Registry {
  const documents: Record<string, AnyDocument> = {};
  for (const doc of input.documents) {
    if (documents[doc.name]) throw new Error(`duplicate document type '${doc.name}'`);
    documents[doc.name] = doc;
  }
  const blocks: Record<string, AnyBlock> = {};
  for (const block of input.blocks) {
    if (blocks[block.name]) throw new Error(`duplicate block type '${block.name}'`);
    blocks[block.name] = block;
  }

  const prefixes = Object.keys(input.ownership).sort((a, b) => b.length - a.length);

  const appRoutes = input.appRoutes ?? [];

  return {
    documents,
    blocks,
    feeds: input.feeds,
    ownership: input.ownership,
    appRoutes,
    isAppRoute(route) {
      return appRoutes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
    },
    document(name) {
      const found = documents[name];
      if (!found) throw new Error(`unknown document type '${name}'`);
      return found;
    },
    block(name) {
      const found = blocks[name];
      if (!found) throw new Error(`unknown block type '${name}'`);
      return found;
    },
    feed(name) {
      const found = input.feeds[name];
      if (!found) throw new Error(`unknown feed '${name}'`);
      return found;
    },
    offered(allow, surface) {
      return allow
        .map((name) => blocks[name])
        .filter((block): block is AnyBlock => Boolean(block))
        .filter((block) => !block.deprecated && block.surfaces.includes(surface));
    },
    ownerOf(route) {
      for (const prefix of prefixes) {
        if (prefix === "/" ? true : route === prefix || route.startsWith(`${prefix}/`)) {
          return input.ownership[prefix]!;
        }
      }
      throw new Error(`no ownership entry matches '${route}' — add one, even a catch-all`);
    },
  };
}

/** Fills a route template from a document's data: "/integrations/{slug}" -> "/integrations/stripe". */
export function routeFor(def: AnyDocument, data: Record<string, unknown>): string | null {
  if (!def.route) return null;
  return def.route.replace(/\{(\w+)\}/g, (_all, field: string) => {
    const value = data[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${def.name}: route needs '${field}', which is empty`);
    }
    return value;
  });
}
