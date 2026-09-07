"use client";

// ONE recursive renderer, walking the manifest the API returned.
//
// The studio holds no copy of the schema. A new field type is one entry in WIDGET_MAP
// below — never a change to this component, and never a change to any form.

import { useId } from "react";
import type { ManifestField } from "@imprint/schema";

export interface RefCandidate {
  id: string;
  title: string;
  route: string | null;
  source: "git" | "cms";
}

export interface FieldContext {
  /** type name -> what a reference field may point at. */
  candidates: Record<string, RefCandidate[]>;
  /** Violations for the whole document, keyed by dotted path. */
  errors: Record<string, string>;
  blockTypes: { name: string; label: string; deprecated: boolean }[];
  feeds: { name: string; label: string }[];
  /** The whole document, so `slug({ from: 'title' })` can read the field it generates from. */
  source?: Record<string, unknown>;
}

interface Props {
  field: ManifestField;
  value: unknown;
  path: string;
  onChange: (value: unknown) => void;
  ctx: FieldContext;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? String(v) : "");

/** "Hero title" -> "hero-title". Used by the slug widget's generate button. */
export function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Plain paragraphs <-> the stored rich-text doc. A real editor slots in here; the
 *  interesting half is emitting structure, and that lives on both sides of this. */
function docToText(value: unknown): string {
  const doc = value as { content?: { content?: { text?: string }[] }[] } | undefined;
  return (doc?.content ?? [])
    .map((p) => (p.content ?? []).map((t) => t.text ?? "").join(""))
    .join("\n\n");
}

function textToDoc(text: string) {
  return {
    type: "doc",
    content: text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

export function FieldRenderer({ field, value, path, onChange, ctx }: Props) {
  const id = useId();
  const error = ctx.errors[path];

  return (
    <div className={`field field-${field.kind}${error ? " field-error" : ""}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required ? <span className="req" aria-label="required"> *</span> : null}
        <span className="kind">{field.kind}</span>
      </label>
      {field.help ? <p className="help">{field.help}</p> : null}

      <Widget id={id} field={field} value={value} path={path} onChange={onChange} ctx={ctx} />

      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}

function Widget({ id, field, value, path, onChange, ctx }: Props & { id: string }) {
  const config = field.config as Record<string, never>;

  switch (field.widget) {
    case "input":
      return (
        <input id={id} type="text" value={str(value)} maxLength={config.max}
          onChange={(e) => onChange(e.target.value)} />
      );

    case "textarea":
      return (
        <textarea id={id} rows={(config.rows as number | undefined) ?? 4} value={str(value)}
          maxLength={config.max} onChange={(e) => onChange(e.target.value)} />
      );

    case "richText":
      return (
        <textarea id={id} rows={8} value={docToText(value)}
          placeholder="One paragraph per blank line."
          onChange={(e) => onChange(textToDoc(e.target.value))} />
      );

    case "slugInput":
      return (
        <div className="row">
          <input id={id} type="text" value={str(value)} onChange={(e) => onChange(slugify(e.target.value))} />
          {config.from ? (
            <button type="button" className="mini"
              onClick={() => onChange(slugify(String(ctx.source?.[String(config.from)] ?? "")))}>
              from {String(config.from)}
            </button>
          ) : null}
        </div>
      );

    case "numberInput":
      return (
        <input id={id} type="number" value={num(value)} min={config.min} max={config.max}
          step={config.integer ? 1 : "any"}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
      );

    case "switch":
      return (
        <input id={id} type="checkbox" checked={value === true}
          onChange={(e) => onChange(e.target.checked)} />
      );

    case "datePicker":
      return (
        <input id={id} type="datetime-local"
          value={str(value) ? str(value).slice(0, 16) : ""}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)} />
      );

    case "urlInput":
      return <input id={id} type="url" value={str(value)} onChange={(e) => onChange(e.target.value)} />;

    case "dropdown":
      return (
        <select id={id} value={str(value)} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {((config.options as unknown as string[]) ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );

    case "checkboxes": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="checks">
          {((config.options as unknown as string[]) ?? []).map((option) => (
            <label key={option} className="check">
              <input type="checkbox" checked={selected.includes(option)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, option] : selected.filter((s) => s !== option))
                } />
              {option}
            </label>
          ))}
        </div>
      );
    }

    case "mediaPicker": {
      const image = (value ?? {}) as Record<string, string>;
      const set = (key: string, next: string) => onChange({ ...image, [key]: next });
      return (
        <div className="sub">
          <input placeholder="Fully-qualified URL (absolutePath)" value={image.absolutePath ?? ""}
            onChange={(e) => set("absolutePath", e.target.value)} />
          <input placeholder="Host-relative path" value={image.path ?? ""}
            onChange={(e) => set("path", e.target.value)} />
          <input placeholder="Alt text — what it shows, not that it is an image"
            value={image.alt ?? ""} onChange={(e) => set("alt", e.target.value)} />
          <input placeholder="Asset id" value={image.id ?? ""} onChange={(e) => set("id", e.target.value)} />
        </div>
      );
    }

    case "linkPicker": {
      const link = (value ?? {}) as Record<string, string>;
      return (
        <div className="sub">
          <input placeholder="Label" value={link.label ?? ""}
            onChange={(e) => onChange({ ...link, label: e.target.value })} />
          <input placeholder="/internal-route or https://…" value={link.href ?? ""}
            onChange={(e) => onChange({ ...link, href: e.target.value })} />
        </div>
      );
    }

    case "referencePicker": {
      const ref = value as { _ref?: string; _source?: string } | undefined;
      const options = ctx.candidates[String(config.to)] ?? [];
      return (
        <select id={id} value={ref?._ref ?? ""}
          onChange={(e) => {
            const chosen = options.find((o) => o.id === e.target.value);
            onChange(chosen ? { _ref: chosen.id, _source: chosen.source } : undefined);
          }}>
          <option value="">—</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title} · {option.source}
            </option>
          ))}
        </select>
      );
    }

    case "referenceSorter": {
      const refs = Array.isArray(value) ? (value as { _ref: string; _source: string }[]) : [];
      const options = ctx.candidates[String(config.to)] ?? [];
      const move = (index: number, by: number) => {
        const next = [...refs];
        const target = index + by;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target]!, next[index]!];
        onChange(next);
      };
      return (
        <div className="sub">
          {refs.map((ref, index) => {
            const found = options.find((o) => o.id === ref._ref);
            return (
              <div className="row" key={`${ref._ref}-${index}`}>
                <span className="rowlabel">{found?.title ?? ref._ref}</span>
                <span className={`chip chip-${ref._source}`}>{ref._source}</span>
                <button type="button" className="mini" onClick={() => move(index, -1)} aria-label="Move up">↑</button>
                <button type="button" className="mini" onClick={() => move(index, 1)} aria-label="Move down">↓</button>
                <button type="button" className="mini danger"
                  onClick={() => onChange(refs.filter((_, i) => i !== index))}>Remove</button>
              </div>
            );
          })}
          <select value="" onChange={(e) => {
            const chosen = options.find((o) => o.id === e.target.value);
            if (chosen) onChange([...refs, { _ref: chosen.id, _source: chosen.source }]);
          }}>
            <option value="">Add…</option>
            {options.filter((o) => !refs.some((r) => r._ref === o.id)).map((option) => (
              <option key={option.id} value={option.id}>{option.title} · {option.source}</option>
            ))}
          </select>
        </div>
      );
    }

    case "fieldset": {
      const object = (value ?? {}) as Record<string, unknown>;
      return (
        <fieldset className="sub">
          {(field.children ?? []).map((child) => (
            <FieldRenderer key={child.name} field={child} value={object[child.name]}
              path={`${path}.${child.name}`} ctx={ctx}
              onChange={(next) => onChange({ ...object, [child.name]: next })} />
          ))}
        </fieldset>
      );
    }

    case "repeater": {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const replace = (index: number, next: Record<string, unknown>) =>
        onChange(items.map((item, i) => (i === index ? next : item)));
      const move = (index: number, by: number) => {
        const next = [...items];
        const target = index + by;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target]!, next[index]!];
        onChange(next);
      };
      return (
        <div className="sub">
          {items.map((item, index) => (
            <fieldset className="repeat" key={index}>
              <legend>
                {index + 1}
                <button type="button" className="mini" onClick={() => move(index, -1)} aria-label="Move up">↑</button>
                <button type="button" className="mini" onClick={() => move(index, 1)} aria-label="Move down">↓</button>
                <button type="button" className="mini danger"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</button>
              </legend>
              {(field.children ?? []).map((child) => (
                <FieldRenderer key={child.name} field={child} value={item[child.name]}
                  path={`${path}[${index}].${child.name}`} ctx={ctx}
                  onChange={(next) => replace(index, { ...item, [child.name]: next })} />
              ))}
            </fieldset>
          ))}
          <button type="button" className="mini" onClick={() => onChange([...items, {}])}>
            Add {field.label.toLowerCase()}
          </button>
        </div>
      );
    }

    case "feedPicker":
      return (
        <select id={id} value={str(value)} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {ctx.feeds
            .filter((feed) => ((config.allow as unknown as string[]) ?? []).includes(feed.name))
            .map((feed) => <option key={feed.name} value={feed.name}>{feed.label}</option>)}
        </select>
      );

    case "blockComposer":
      // Rendered by the composer, which owns selection and the preview bridge.
      return null;
  }
}
