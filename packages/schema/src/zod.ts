// FieldMap -> zod. The API validates writes with this, and the studio shows inline
// errors from the SAME schema, so the studio can never accept something the API rejects.

import { z, type ZodTypeAny } from "zod";
import type { AnyField, FieldMap } from "./types";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const richTextNode: ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.unknown()).optional(),
    marks: z.array(z.object({ type: z.string(), attrs: z.record(z.unknown()).optional() })).optional(),
    text: z.string().optional(),
    content: z.array(richTextNode).optional(),
  })
);

const refShape = (sources?: ("git" | "cms")[]) =>
  z.object({
    _ref: z.string().min(1),
    _source: sources && sources.length ? z.enum(sources as [string, ...string[]]) : z.enum(["git", "cms"]),
  });

function base(field: AnyField): ZodTypeAny {
  switch (field.kind) {
    case "text": {
      let s = z.string();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      if (field.pattern) s = s.regex(new RegExp(field.pattern));
      return s;
    }
    case "textArea": {
      let s = z.string();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      return s;
    }
    case "richText":
      return z.object({ type: z.literal("doc"), content: z.array(richTextNode) });
    case "slug":
      return z.string().min(1).regex(field.pattern ? new RegExp(field.pattern) : SLUG,
        "lower-case words joined by single hyphens");
    case "number": {
      let n = z.number();
      if (field.integer) n = n.int();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      return n;
    }
    case "boolean":
      return z.boolean();
    case "datetime":
      return z.string().datetime({ offset: true });
    case "url": {
      const schemes = field.schemes ?? ["https", "http"];
      return z.string().refine(
        (v) => schemes.some((s) => v.startsWith(`${s}:`)),
        { message: `must start with one of: ${schemes.join(", ")}` }
      );
    }
    case "select":
      return z.enum(field.options as unknown as [string, ...string[]]);
    case "multiSelect": {
      let a = z.array(z.enum(field.options as unknown as [string, ...string[]]));
      if (field.minCount !== undefined) a = a.min(field.minCount);
      if (field.maxCount !== undefined) a = a.max(field.maxCount);
      return a;
    }
    case "image":
      return z.object({
        id: z.string().min(1),
        alt: z.string(),
        path: z.string(),
        absolutePath: z.string(),
        focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
      });
    case "link":
      return z.object({
        label: z.string().min(1),
        href: field.external
          ? z.string().min(1)
          : z.string().startsWith("/", "internal links start with /"),
      });
    case "reference":
      return refShape(field.sources);
    case "referenceList": {
      let a = z.array(refShape(field.sources));
      if (field.minCount !== undefined) a = a.min(field.minCount);
      if (field.maxCount !== undefined) a = a.max(field.maxCount);
      return a;
    }
    case "object":
      return zodFor(field.fields);
    case "objectList": {
      let a = z.array(zodFor(field.fields));
      if (field.minCount !== undefined) a = a.min(field.minCount);
      if (field.maxCount !== undefined) a = a.max(field.maxCount);
      return a;
    }
    case "blocks": {
      let a = z.array(
        z.object({ _type: z.enum(field.allow as [string, ...string[]]), _key: z.string().min(1) })
          .passthrough()
      );
      if (field.minCount !== undefined) a = a.min(field.minCount);
      if (field.maxCount !== undefined) a = a.max(field.maxCount);
      return a;
    }
    case "feedRef":
      return z.enum(field.allow as [string, ...string[]]);
  }
}

/** One field's validator, with `required` applied. */
export function zodForField(field: AnyField): ZodTypeAny {
  const schema = base(field);
  return field.required ? schema : schema.optional();
}

/** A field map's validator. Unknown keys are stripped, not rejected: a field removed
 *  from the schema must not make every stored document invalid at once. */
export function zodFor(fields: FieldMap): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const [name, field] of Object.entries(fields)) shape[name] = zodForField(field);
  return z.object(shape);
}
