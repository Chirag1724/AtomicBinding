// The field builders. `f.text({ required: true })` is the ONLY place a field is
// described; the zod schema, the editor manifest, the API types and the render props
// are all derived from what these return.

import type {
  BooleanField, DatetimeField, FeedRefField, FieldMap, ImageField, LinkField,
  MultiSelectField, NumberField, ObjectField, ObjectListField, ReferenceField,
  ReferenceListField, ReqOf, RichTextField, SelectField, SlugField, BlocksField,
  TextAreaField, TextField, UrlField,
} from "./types";

/** Drops `required` back in as a literal so the type tracks it. */
const mk = <T extends object>(kind: string, opts: object | undefined, extra?: object): T =>
  ({ kind, required: false, ...extra, ...(opts ?? {}) }) as T;

export const f = {
  text: <const O extends Omit<TextField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<TextField<ReqOf<O>>>("text", o),

  textArea: <const O extends Omit<TextAreaField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<TextAreaField<ReqOf<O>>>("textArea", o),

  richText: <const O extends Omit<RichTextField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<RichTextField<ReqOf<O>>>("richText", o),

  slug: <const O extends Omit<SlugField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<SlugField<ReqOf<O>>>("slug", o, { pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),

  number: <const O extends Omit<NumberField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<NumberField<ReqOf<O>>>("number", o),

  boolean: <const O extends Omit<BooleanField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<BooleanField<ReqOf<O>>>("boolean", o),

  datetime: <const O extends Omit<DatetimeField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<DatetimeField<ReqOf<O>>>("datetime", o),

  url: <const O extends Omit<UrlField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<UrlField<ReqOf<O>>>("url", o, { schemes: ["https", "http", "mailto"] }),

  select: <const O extends { options: readonly string[]; required?: boolean; label?: string; help?: string; default?: string }>(o: O) =>
    mk<SelectField<O["options"], ReqOf<O>>>("select", o),

  multiSelect: <const O extends { options: readonly string[]; required?: boolean; label?: string; help?: string; minCount?: number; maxCount?: number }>(o: O) =>
    mk<MultiSelectField<O["options"], ReqOf<O>>>("multiSelect", o),

  image: <const O extends Omit<ImageField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<ImageField<ReqOf<O>>>("image", o),

  link: <const O extends Omit<LinkField, "kind" | "required" | "_out"> & { required?: boolean }>(o?: O) =>
    mk<LinkField<ReqOf<O>>>("link", o),

  reference: <const O extends Omit<ReferenceField, "kind" | "required" | "_out"> & { required?: boolean }>(o: O) =>
    mk<ReferenceField<ReqOf<O>>>("reference", o),

  referenceList: <const O extends Omit<ReferenceListField, "kind" | "required" | "_out"> & { required?: boolean }>(o: O) =>
    mk<ReferenceListField<ReqOf<O>>>("referenceList", o),

  object: <const O extends { fields: FieldMap; required?: boolean; label?: string; help?: string }>(o: O) =>
    mk<ObjectField<O["fields"], ReqOf<O>>>("object", o),

  objectList: <const O extends { fields: FieldMap; required?: boolean; label?: string; help?: string; minCount?: number; maxCount?: number }>(o: O) =>
    mk<ObjectListField<O["fields"], ReqOf<O>>>("objectList", o),

  blocks: <const O extends Omit<BlocksField, "kind" | "required" | "_out"> & { required?: boolean }>(o: O) =>
    mk<BlocksField<ReqOf<O>>>("blocks", o),

  feedRef: <const O extends Omit<FeedRefField, "kind" | "required" | "_out"> & { required?: boolean }>(o: O) =>
    mk<FeedRefField<ReqOf<O>>>("feedRef", o),
};
