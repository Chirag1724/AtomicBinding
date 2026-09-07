// Prop types for block components, and the matching item-shape types for feeds.
//
// Both sides brand the SAME nominal types, which is the whole trick: a binding maps a
// feed path to a prop, and the compiler rejects the pair when the brands differ. That
// turns `data.0.media_file_banner.path -> image` from a magic string into a type error.

declare const brand: unique symbol;

export interface Branded<T extends string> { readonly [brand]: T }

export type Txt = Branded<"text">;
export type LongTxt = Branded<"longText">;
export type Html = Branded<"html">;
export type Num = Branded<"number">;
export type Bool = Branded<"boolean">;
/** An internal route with a leading slash. Never a fully-qualified URL. */
export type Route = Branded<"route">;
/** Fully-qualified image URL — the one to bind when the page goes through a CDN. */
export type ImageUrl = Branded<"imageUrl">;
/** Host-relative image path. NOT interchangeable with ImageUrl. */
export type ImagePath = Branded<"imagePath">;
/** A pre-formatted date string. Render it; never compute with it. */
export type DisplayDate = Branded<"displayDate">;

export type BrandName =
  | "text" | "longText" | "html" | "number" | "boolean"
  | "route" | "imageUrl" | "imagePath" | "displayDate";

export interface Leaf<B extends BrandName> {
  brand: B;
  required?: boolean;
  readonly _t?: Branded<B>;
}

const leaf = <B extends BrandName>(brand: B, required = false): Leaf<B> => ({ brand, required });

/** Declares what a feed's items expose, at flat dotted paths. */
export const s = {
  text: () => leaf("text"),
  longText: () => leaf("longText"),
  html: () => leaf("html"),
  number: () => leaf("number"),
  boolean: () => leaf("boolean"),
  route: () => leaf("route"),
  imageUrl: () => leaf("imageUrl"),
  imagePath: () => leaf("imagePath"),
  displayDate: () => leaf("displayDate"),
};

/** Declares what a block's card props are. Same brands as `s`, deliberately. */
export const p = {
  text: (o?: { required?: boolean }) => leaf("text", o?.required),
  longText: (o?: { required?: boolean }) => leaf("longText", o?.required),
  html: (o?: { required?: boolean }) => leaf("html", o?.required),
  number: (o?: { required?: boolean }) => leaf("number", o?.required),
  boolean: (o?: { required?: boolean }) => leaf("boolean", o?.required),
  route: (o?: { required?: boolean }) => leaf("route", o?.required),
  imageUrl: (o?: { required?: boolean }) => leaf("imageUrl", o?.required),
  imagePath: (o?: { required?: boolean }) => leaf("imagePath", o?.required),
  displayDate: (o?: { required?: boolean }) => leaf("displayDate", o?.required),
};

export type AnyLeaf = Leaf<BrandName>;
export type ItemShape = Record<string, AnyLeaf>;
export type CardShape = Record<string, AnyLeaf>;

/** The runtime type a brand resolves to once the resolver has read the value. */
export type Rendered<B extends BrandName> =
  B extends "number" ? number : B extends "boolean" ? boolean : string;

/** What a component actually receives for a card shape. */
export type Card<S extends CardShape> = {
  [K in keyof S]: S[K] extends Leaf<infer B> ? Rendered<B> | null : never;
};
