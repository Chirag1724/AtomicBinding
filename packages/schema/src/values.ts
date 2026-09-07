// The runtime value shapes the field types store. Deliberately small and explicit:
// every one of these is something the editor writes and a component reads, so a change
// here is a change to stored data.

/** Structured rich text. Tiptap-compatible shape; we own the type, not the editor. */
export interface RichTextDoc {
  type: "doc";
  content: RichTextNode[];
}

export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
  content?: RichTextNode[];
}

/**
 * An image. Both paths are stored because they are NOT interchangeable: `path` is
 * relative to the media host, `absolutePath` is fully qualified. Binding the wrong one
 * breaks images on exactly the pages that go through a CDN, so the schema decides which
 * a given prop wants — see `p.imageUrl()` vs `p.imagePath()` in bindings.
 */
export interface ImageValue {
  id: string;
  alt: string;
  path: string;
  absolutePath: string;
  /** Focal point, 0..1 on each axis. Stored on the reference, not on the asset. */
  focal?: { x: number; y: number };
}

export interface LinkValue {
  label: string;
  /** Internal route (leading slash) or absolute URL. */
  href: string;
}

/** Which authoring surface a node came from. Nothing downstream branches on it. */
export type Source = "git" | "cms";

/**
 * A reference. `_source` is the cross-boundary mechanism: a reference to a git-owned
 * document stores its ROUTE as the id, because filesystem content has no database id.
 */
export interface Ref {
  _ref: string;
  _source: Source;
}

/** One block inside a `blocks` field. `_key` is stable for the life of the block. */
export interface BlockInstance {
  _type: string;
  _key: string;
  [field: string]: unknown;
}

/** A resolved reference, as the delivery API and the graph hand it out. */
export interface ResolvedRef extends Ref {
  /** The field path that held it, e.g. "docsEntry" or "changes[2]". */
  path: string;
  title: string | null;
  route: string | null;
  /** True when nothing in the graph answers to `_ref`. */
  missing: boolean;
}
