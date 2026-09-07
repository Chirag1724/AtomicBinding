// Field definitions, and the type-level machinery that turns a field map into the
// TypeScript type of the data it stores. One definition, two outputs: a zod schema for
// validation and a manifest for the editor. No codegen, so they cannot drift.

import type { BlockInstance, ImageValue, LinkValue, Ref, RichTextDoc } from "./values";

export type FieldKind =
  | "text" | "textArea" | "richText" | "slug" | "number" | "boolean"
  | "datetime" | "url" | "select" | "multiSelect" | "image" | "link"
  | "reference" | "referenceList" | "object" | "objectList" | "blocks" | "feedRef";

/** Options every field shares. */
export interface CommonOpts {
  label?: string;
  /** Shown under the input in the studio. Write it for the person, not the schema. */
  help?: string;
  /** Hidden from the editor but still stored and rendered. */
  readOnly?: boolean;
}

export interface FieldBase<K extends FieldKind, Out, Req extends boolean> extends CommonOpts {
  kind: K;
  required: Req;
  /** Phantom: carries the stored type. Never present at runtime. */
  readonly _out?: Out;
}

// ── The field types ─────────────────────────────────────────────────────────────

export interface TextField<R extends boolean = false> extends FieldBase<"text", string, R> {
  min?: number; max?: number; pattern?: string; default?: string;
}
export interface TextAreaField<R extends boolean = false> extends FieldBase<"textArea", string, R> {
  min?: number; max?: number; rows?: number;
}
export interface RichTextField<R extends boolean = false> extends FieldBase<"richText", RichTextDoc, R> {
  /** Marks the renderer will pass through. Reviewable in the same diff as the block. */
  marks?: string[];
  nodes?: string[];
}
export interface SlugField<R extends boolean = false> extends FieldBase<"slug", string, R> {
  /** Field to generate from, e.g. "name". */
  from?: string;
  unique?: boolean;
  pattern?: string;
}
export interface NumberField<R extends boolean = false> extends FieldBase<"number", number, R> {
  min?: number; max?: number; integer?: boolean; default?: number;
}
export interface BooleanField<R extends boolean = false> extends FieldBase<"boolean", boolean, R> {
  default?: boolean;
}
export interface DatetimeField<R extends boolean = false> extends FieldBase<"datetime", string, R> {
  min?: string; max?: string;
}
export interface UrlField<R extends boolean = false> extends FieldBase<"url", string, R> {
  schemes?: string[];
}
export interface SelectField<O extends readonly string[] = readonly string[], R extends boolean = false>
  extends FieldBase<"select", O[number], R> {
  options: O;
  default?: O[number];
}
export interface MultiSelectField<O extends readonly string[] = readonly string[], R extends boolean = false>
  extends FieldBase<"multiSelect", O[number][], R> {
  options: O;
  minCount?: number; maxCount?: number;
}
export interface ImageField<R extends boolean = false> extends FieldBase<"image", ImageValue, R> {
  mime?: string[];
}
export interface LinkField<R extends boolean = false> extends FieldBase<"link", LinkValue, R> {
  /** Allow absolute URLs as well as internal routes. */
  external?: boolean;
}
export interface ReferenceField<R extends boolean = false> extends FieldBase<"reference", Ref, R> {
  /** Exactly one target type. Polymorphic references make queries untypable and the
   *  editor's picker meaningless — model N optional fields instead. */
  to: string;
  /** Which sources may satisfy it. Omit for "either". */
  sources?: ("git" | "cms")[];
}
export interface ReferenceListField<R extends boolean = false> extends FieldBase<"referenceList", Ref[], R> {
  to: string;
  sources?: ("git" | "cms")[];
  minCount?: number; maxCount?: number;
  /** True when the stored order is meaningful. */
  ordered?: boolean;
}
export interface ObjectField<F extends FieldMap = FieldMap, R extends boolean = false>
  extends FieldBase<"object", unknown, R> {
  fields: F;
}
export interface ObjectListField<F extends FieldMap = FieldMap, R extends boolean = false>
  extends FieldBase<"objectList", unknown, R> {
  fields: F;
  minCount?: number; maxCount?: number;
}
export interface BlocksField<R extends boolean = false> extends FieldBase<"blocks", BlockInstance[], R> {
  /** Block type names this field accepts. A block never accepts `blocks` itself. */
  allow: string[];
  minCount?: number; maxCount?: number;
}
export interface FeedRefField<R extends boolean = false> extends FieldBase<"feedRef", string, R> {
  /** Feed names this field accepts. */
  allow: string[];
}

export type AnyField =
  | TextField<boolean> | TextAreaField<boolean> | RichTextField<boolean> | SlugField<boolean>
  | NumberField<boolean> | BooleanField<boolean> | DatetimeField<boolean> | UrlField<boolean>
  | SelectField<readonly string[], boolean> | MultiSelectField<readonly string[], boolean>
  | ImageField<boolean> | LinkField<boolean>
  | ReferenceField<boolean> | ReferenceListField<boolean>
  | ObjectField<FieldMap, boolean> | ObjectListField<FieldMap, boolean>
  | BlocksField<boolean> | FeedRefField<boolean>;

export type FieldMap = Record<string, AnyField>;

// ── Inference ───────────────────────────────────────────────────────────────────

// Object fields are resolved HERE rather than in their phantom, so `AnyField` does not
// refer to itself while TypeScript is still working out what its members are.
type Out<F> =
  F extends ObjectField<infer M, boolean> ? Infer<M> :
  F extends ObjectListField<infer M, boolean> ? Infer<M>[] :
  F extends { readonly _out?: infer O } ? O : never;
type RequiredNames<F extends FieldMap> = { [K in keyof F]: F[K]["required"] extends true ? K : never }[keyof F];
type OptionalNames<F extends FieldMap> = { [K in keyof F]: F[K]["required"] extends true ? never : K }[keyof F];

/** The TypeScript type of the data a field map stores. */
export type Infer<F extends FieldMap> =
  { [K in RequiredNames<F>]: Out<F[K]> } & { [K in OptionalNames<F>]?: Out<F[K]> };

/** `required: true` in the options object becomes `true` at the type level. */
export type ReqOf<O> = O extends { required: true } ? true : false;
