// FieldMap -> the editor-facing manifest. The studio's ONE recursive renderer walks
// this; a new field type is one entry in the widget map, never a change to the renderer.

import type { AnyField, FieldKind, FieldMap } from "./types";

export type Widget =
  | "input" | "textarea" | "richText" | "slugInput" | "numberInput" | "switch"
  | "datePicker" | "urlInput" | "dropdown" | "checkboxes" | "mediaPicker"
  | "linkPicker" | "referencePicker" | "referenceSorter" | "fieldset"
  | "repeater" | "blockComposer" | "feedPicker";

/** The one place a field kind is mapped to a control. */
export const WIDGETS: Record<FieldKind, Widget> = {
  text: "input",
  textArea: "textarea",
  richText: "richText",
  slug: "slugInput",
  number: "numberInput",
  boolean: "switch",
  datetime: "datePicker",
  url: "urlInput",
  select: "dropdown",
  multiSelect: "checkboxes",
  image: "mediaPicker",
  link: "linkPicker",
  reference: "referencePicker",
  referenceList: "referenceSorter",
  object: "fieldset",
  objectList: "repeater",
  blocks: "blockComposer",
  feedRef: "feedPicker",
};

export interface ManifestField {
  name: string;
  kind: FieldKind;
  widget: Widget;
  label: string;
  help?: string;
  required: boolean;
  readOnly?: boolean;
  /** Kind-specific config the widget needs: options, allow lists, min/max, target type. */
  config: Record<string, unknown>;
  /** Present for object / objectList. */
  children?: ManifestField[];
}

/** "heroTitle" -> "Hero title". Used when a field declares no label. */
export function humanize(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function configFor(field: AnyField): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  const copy = (...keys: string[]) => {
    for (const k of keys) {
      const v = (field as unknown as Record<string, unknown>)[k];
      if (v !== undefined) c[k] = v;
    }
  };
  copy("min", "max", "pattern", "default", "rows", "integer", "schemes", "marks", "nodes",
    "options", "minCount", "maxCount", "mime", "external", "to", "sources", "allow",
    "from", "unique", "ordered");
  return c;
}

export function manifestForField(name: string, field: AnyField): ManifestField {
  const entry: ManifestField = {
    name,
    kind: field.kind,
    widget: WIDGETS[field.kind],
    label: field.label ?? humanize(name),
    required: Boolean(field.required),
    config: configFor(field),
  };
  if (field.help) entry.help = field.help;
  if (field.readOnly) entry.readOnly = true;
  if (field.kind === "object" || field.kind === "objectList") {
    entry.children = manifestFor(field.fields);
  }
  return entry;
}

export function manifestFor(fields: FieldMap): ManifestField[] {
  return Object.entries(fields).map(([name, field]) => manifestForField(name, field));
}
