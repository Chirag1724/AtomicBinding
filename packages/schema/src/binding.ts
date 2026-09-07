// The binding language.
//
// A binding is STORED as flat rows of two strings — that is the delivery format and it
// cannot change, because templates already in the database use it. So the typed form is
// a COMPILATION TARGET, not a replacement: `compile(decompile(rows)) === rows` for every
// stored binding, which is what makes the typed form safe to introduce.

import type { AnyLeaf, Branded, BrandName, CardShape, ItemShape, Leaf } from "./props";

// ── Feeds ───────────────────────────────────────────────────────────────────────

export interface FeedDef<S extends ItemShape = ItemShape> {
  name: string;
  /** The key rows nest under, e.g. "results". Null when the feed IS the array. */
  container: string | null;
  item: S;
  /** True when the feed's stored key may differ per deployment; see the alias table. */
  aliasable?: boolean;
  /** A query feed's length is unknown at author time, so its binding replicates. */
  query?: boolean;
  label?: string;
  /**
   * How the graph fills this feed. Declarative on purpose: a feed the graph can resolve
   * from its own description needs no per-feed code, so adding one is a schema change.
   */
  select?: {
    /** Document type to gather. */
    type: string;
    /** Field to order by. `updatedAt`, `title` and any data field are allowed. */
    sort?: string;
    direction?: "asc" | "desc";
    limit?: number;
  };
}

export function defineFeed<const S extends ItemShape>(def: {
  name: string;
  container?: string | null;
  item: S;
  aliasable?: boolean;
  query?: boolean;
  label?: string;
  select?: FeedDef["select"];
}): FeedDef<S> {
  return { ...def, container: def.container ?? null };
}

export function defineFeeds<const T extends Record<string, Omit<FeedDef, "name">>>(
  defs: T
): { [K in keyof T]: FeedDef<T[K]["item"] extends ItemShape ? T[K]["item"] : ItemShape> } {
  const out: Record<string, FeedDef> = {};
  for (const [name, def] of Object.entries(defs)) out[name] = { ...def, name, container: def.container ?? null };
  return out as never;
}

// ── The typed accessor ──────────────────────────────────────────────────────────

type LeafType<L> = L extends Leaf<infer B extends BrandName> ? Branded<B> : never;

type Nest<P extends string, L> =
  P extends `${infer H}.${infer T}` ? { [K in H]: Nest<T, L> } : { [K in P]: L };

type UnionToIntersection<U> =
  (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/** Expands a feed's flat dotted paths into the nested object a binding reads from. */
export type Accessor<S extends ItemShape> = UnionToIntersection<
  { [K in keyof S & string]: Nest<K, LeafType<S[K]>> }[keyof S & string]
>;

/** The map a binding declares: every key is a card prop, every value reads one path. */
export type BindingMap<S extends ItemShape, C extends CardShape> = {
  [K in keyof C]?: (item: Accessor<S>) => C[K] extends Leaf<infer B extends BrandName> ? Branded<B> : never;
};

const PATH = Symbol("imprint.path");

function pathProxy(prefix: string[]): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === PATH) return prefix.join(".");
        if (typeof prop === "symbol") return undefined;
        return pathProxy([...prefix, prop]);
      },
    }
  );
}

function readPath(value: unknown): string {
  const path = (value as Record<symbol, unknown> | null)?.[PATH];
  if (typeof path !== "string" || path.length === 0) {
    throw new Error("a binding accessor must read at least one field, e.g. `i => i.title`");
  }
  return path;
}

// ── The authored form ───────────────────────────────────────────────────────────

/** One stored row: read `source`, write it to the prop named `target`. */
export interface Row {
  source: string;
  target: string;
}

export type BindingMode = "cards" | "replicate" | "self";

export interface BindingDef {
  mode: BindingMode;
  /** Null for a `self` binding, which reads the page record directly. */
  feed: string | null;
  container: string | null;
  /** How many cards to emit. Always 1 for `replicate` and `self`. */
  cards: number;
  /** The per-card rule: target prop -> path within one item. */
  rule: { target: string; path: string }[];
}

class Binder<S extends ItemShape, C extends CardShape> {
  constructor(
    private readonly feed: FeedDef<S>,
    private readonly card: C,
    private readonly count: number,
    private readonly mode: BindingMode
  ) {}

  /** Bind a fixed number of cards. A curated row of six is `cards(6)`. */
  cards(n: number): Binder<S, C> {
    if (!Number.isInteger(n) || n < 1) throw new Error(`cards(${n}): expected a positive integer`);
    return new Binder(this.feed, this.card, n, "cards");
  }

  /** Describe card 0 only; the resolver applies the rule to every item the feed returned. */
  replicate(): Binder<S, C> {
    return new Binder(this.feed, this.card, 1, "replicate");
  }

  map(rules: BindingMap<S, C>): BindingDef {
    const rule: { target: string; path: string }[] = [];
    for (const [target, accessor] of Object.entries(rules)) {
      if (typeof accessor !== "function") continue;
      if (!(target in this.card)) {
        throw new Error(`'${target}' is not a prop of this card shape`);
      }
      const path = readPath((accessor as (i: unknown) => unknown)(pathProxy([])));
      const declared = this.feed.item[path];
      if (!declared) {
        const near = nearest(path, Object.keys(this.feed.item));
        throw new Error(
          `feed '${this.feed.name}' declares no path '${path}'` + (near ? `. Did you mean '${near}'?` : "")
        );
      }
      const prop = this.card[target] as AnyLeaf;
      if (prop.brand !== declared.brand) {
        throw new Error(
          `feed '${this.feed.name}.${path}' is ${declared.brand}, but prop '${target}' is ${prop.brand}`
        );
      }
      rule.push({ target, path });
    }
    if (rule.length === 0) throw new Error("a binding must map at least one prop");
    return {
      mode: this.mode,
      feed: this.feed.name,
      container: this.feed.container,
      cards: this.mode === "cards" ? this.count : 1,
      rule,
    };
  }
}

/**
 * Start a binding. Both halves are checked: the path must exist on the feed's declared
 * item shape, and its brand must match the prop's.
 */
export function bind<const S extends ItemShape, const C extends CardShape>(
  feed: FeedDef<S>,
  card: C
): Binder<S, C> {
  return new Binder(feed, card, 1, feed.query ? "replicate" : "cards");
}

/** A binding that reads the page's own record rather than a feed — an article hero
 *  reading `summary` off the post. One template then serves every article. */
export function bindSelf<const C extends CardShape>(
  card: C,
  rules: Record<string, (item: Record<string, never>) => unknown>
): BindingDef {
  const rule: { target: string; path: string }[] = [];
  for (const [target, accessor] of Object.entries(rules)) {
    if (!(target in card)) throw new Error(`'${target}' is not a prop of this card shape`);
    rule.push({ target, path: readPath(accessor(pathProxy([]) as Record<string, never>)) });
  }
  return { mode: "self", feed: null, container: null, cards: 1, rule };
}

// ── compile / decompile ─────────────────────────────────────────────────────────

/** The prefix for one card of a binding. */
export function cardPrefix(def: Pick<BindingDef, "feed" | "container">, index: number): string {
  if (def.feed === null) return "";
  return def.container ? `${def.feed}.${def.container}.${index}` : `${def.feed}.${index}`;
}

/** The typed form -> the flat rows the store holds. */
export function compile(def: BindingDef): Row[] {
  const rows: Row[] = [];
  for (let index = 0; index < def.cards; index += 1) {
    const prefix = cardPrefix(def, index);
    for (const { target, path } of def.rule) {
      rows.push({ source: prefix ? `${prefix}.${path}` : path, target });
    }
  }
  return rows;
}

const INDEXED = /^([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\.(\d+)\.(.+)$/;

/**
 * The flat rows -> the typed form. Lossless for every shape `compile` emits, which is
 * what lets the typed form be introduced over data we did not write.
 */
export function decompile(rows: Row[]): BindingDef {
  if (rows.length === 0) throw new Error("cannot decompile zero rows");
  const first = rows[0]!;
  const match = INDEXED.exec(first.source);

  if (!match) {
    // No feed prefix and no index: every row reads the page record itself.
    return {
      mode: "self",
      feed: null,
      container: null,
      cards: 1,
      rule: rows.map((r) => ({ target: r.target, path: r.source })),
    };
  }

  const [, feed, container = null, , ] = match;
  const indices = new Set<number>();
  const byIndex = new Map<number, { target: string; path: string }[]>();

  for (const row of rows) {
    const m = INDEXED.exec(row.source);
    if (!m) throw new Error(`row '${row.source}' does not belong to feed '${feed}'`);
    const [, rowFeed, rowContainer = null, rawIndex, path] = m;
    if (rowFeed !== feed || (rowContainer ?? null) !== (container ?? null)) {
      throw new Error(`rows mix feeds: '${feed}' and '${rowFeed}'`);
    }
    const index = Number(rawIndex);
    indices.add(index);
    const bucket = byIndex.get(index) ?? [];
    bucket.push({ target: row.target, path: path! });
    byIndex.set(index, bucket);
  }

  const ordered = [...indices].sort((a, b) => a - b);
  if (ordered.some((value, position) => value !== position)) {
    throw new Error(`feed '${feed}' has gaps in its card indices: ${ordered.join(", ")}`);
  }

  return {
    mode: "cards",
    feed: feed!,
    container: container ?? null,
    cards: ordered.length,
    rule: byIndex.get(0) ?? [],
  };
}

/** S4: the round-trip that must hold for every stored binding. */
export function roundTrips(rows: Row[]): boolean {
  try {
    return rowsEqual(compile(decompile(rows)), rows);
  } catch {
    return false;
  }
}

export function rowsEqual(a: Row[], b: Row[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, index) => row.source === b[index]!.source && row.target === b[index]!.target);
}

// ── Resolution ──────────────────────────────────────────────────────────────────

/** Reads a dotted path, indexing arrays on numeric segments. */
export function readAt(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  for (const segment of path.split(".")) {
    if (cursor === null || cursor === undefined) return undefined;
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      cursor = Number.isInteger(index) ? cursor[index] : undefined;
      continue;
    }
    if (typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/**
 * Rows + the resolution root -> the cards a component receives.
 *
 * For a `replicate` binding the rule describes card 0 and is applied to every item the
 * feed returned: you write the design once and it holds for n cards.
 */
export function resolveBinding(
  rows: Row[],
  root: unknown,
  options: { aliases?: Record<string, string> } = {}
): Record<string, unknown>[] {
  if (rows.length === 0) return [];
  const def = decompile(rows);
  const feed = def.feed ? options.aliases?.[def.feed] ?? def.feed : null;

  if (def.mode === "self") {
    const card: Record<string, unknown> = {};
    for (const { target, path } of def.rule) card[target] = readAt(root, path) ?? null;
    return [card];
  }

  const base = def.container ? `${feed}.${def.container}` : feed!;
  const list = readAt(root, base);
  const available = Array.isArray(list) ? list.length : 0;

  // A single-card rule against a longer feed is a replicated design, not a one-card row.
  const count = def.cards === 1 && available > 1 ? available : Math.min(def.cards, available);

  const cards: Record<string, unknown>[] = [];
  for (let index = 0; index < count; index += 1) {
    const card: Record<string, unknown> = {};
    for (const { target, path } of def.rule) {
      card[target] = readAt(root, `${base}.${index}.${path}`) ?? null;
    }
    cards.push(card);
  }
  return cards;
}

/** True when a binding reads live content at all, rather than only the block's own fields. */
export function hasLiveBinding(rows: Row[]): boolean {
  return rows.some((row) => row.source.length > 0);
}

// ── Diagnostics ─────────────────────────────────────────────────────────────────

function nearest(needle: string, haystack: string[]): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const candidate of haystack) {
    const score = distance(needle, candidate);
    if (score < bestScore) { bestScore = score; best = candidate; }
  }
  return bestScore <= Math.max(3, Math.floor(needle.length / 3)) ? best : null;
}

function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i]![j] = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
    }
  }
  return rows[a.length]![b.length]!;
}
