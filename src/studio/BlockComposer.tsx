"use client";

// The block composer.
//
// Every block carries a stable `_key`, generated on insert and never mutated: it is the
// React key, the reorder identity, and the click-to-edit target the preview posts back.

import { useState } from "react";
import type { BlockInstance, ManifestField } from "@imprint/schema";
import { FieldRenderer, type FieldContext } from "./FieldRenderer";

export interface BlockMeta {
  name: string;
  label: string;
  deprecated: boolean;
  surfaces: string[];
  fields: ManifestField[];
  defaultRows: { source: string; target: string }[];
  hasCard: boolean;
}

interface Props {
  field: ManifestField;
  blocks: BlockInstance[];
  onChange: (blocks: BlockInstance[]) => void;
  meta: Record<string, BlockMeta>;
  ctx: FieldContext;
  selected: string | null;
  onSelect: (key: string | null) => void;
}

const newKey = () => Math.random().toString(36).slice(2, 10);

export function BlockComposer({ field, blocks, onChange, meta, ctx, selected, onSelect }: Props) {
  const [undoable, setUndoable] = useState<{ block: BlockInstance; index: number } | null>(null);
  const allow = ((field.config.allow as string[] | undefined) ?? []).filter((name) => {
    const block = meta[name];
    return block && !block.deprecated && block.surfaces.includes("cms");
  });

  const move = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  const add = (type: string) => {
    const block = meta[type];
    const instance: BlockInstance = { _type: type, _key: newKey() };
    // A bound block arrives already bound, so it shows real content immediately.
    if (block?.hasCard && block.defaultRows.length) instance._binding = block.defaultRows;
    onChange([...blocks, instance]);
    onSelect(instance._key);
  };

  const remove = (index: number) => {
    setUndoable({ block: blocks[index]!, index });
    onChange(blocks.filter((_, i) => i !== index));
  };

  const undo = () => {
    if (!undoable) return;
    const next = [...blocks];
    next.splice(undoable.index, 0, undoable.block);
    onChange(next);
    setUndoable(null);
  };

  const duplicate = (index: number) => {
    const copy = { ...blocks[index]!, _key: newKey() };
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };

  const update = (index: number, patch: Record<string, unknown>) =>
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)));

  return (
    <div className="composer">
      <div className="composer-head">
        <h3>{field.label}</h3>
        <span className="count">{blocks.length} block{blocks.length === 1 ? "" : "s"}</span>
      </div>

      {undoable ? (
        <p className="undo">
          Removed a {meta[undoable.block._type]?.label ?? undoable.block._type}.{" "}
          <button type="button" className="mini" onClick={undo}>Undo</button>
        </p>
      ) : null}

      <ol className="blocklist">
        {blocks.map((block, index) => {
          const info = meta[block._type];
          const open = selected === block._key;
          const preview = previewLabel(block, info);

          return (
            <li key={block._key}>
              <div
                className={`blockcard${open ? " open" : ""}`}
                tabIndex={0}
                onKeyDown={(event) => {
                  // Keyboard reorder is not optional.
                  if (event.key === "ArrowUp" && event.altKey) { event.preventDefault(); move(index, -1); }
                  if (event.key === "ArrowDown" && event.altKey) { event.preventDefault(); move(index, 1); }
                }}
              >
                <button type="button" className="blockhead"
                  onClick={() => onSelect(open ? null : block._key)}
                  aria-expanded={open}>
                  <span className="blocktype">{info?.label ?? block._type}</span>
                  <span className="blockprev">{preview}</span>
                  {block._binding ? <span className="chip chip-cms">bound</span> : null}
                  {!info ? <span className="chip chip-fail">unregistered</span> : null}
                </button>

                <div className="blockops">
                  <button type="button" className="mini" onClick={() => move(index, -1)} aria-label="Move up">↑</button>
                  <button type="button" className="mini" onClick={() => move(index, 1)} aria-label="Move down">↓</button>
                  <button type="button" className="mini" onClick={() => duplicate(index)}>Duplicate</button>
                  <button type="button" className="mini danger" onClick={() => remove(index)}>Delete</button>
                </div>
              </div>

              {open && info ? (
                <div className="blockfields">
                  {info.fields.map((child) => (
                    <FieldRenderer key={child.name} field={child} value={block[child.name]}
                      path={`${field.name}[${index}].${child.name}`} ctx={ctx}
                      onChange={(next) => update(index, { [child.name]: next })} />
                  ))}

                  {info.hasCard ? (
                    <div className="bindingnote">
                      <p>
                        This block&apos;s cards come from a feed. Its binding is compiled from the
                        schema, so every path is checked against the feed&apos;s declared shape.
                      </p>
                      <pre>{((block._binding as { source: string; target: string }[] | undefined) ?? [])
                        .map((row) => `${row.source}  →  ${row.target}`).join("\n") || "no binding"}</pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="addblock">
        <select value="" onChange={(event) => { if (event.target.value) add(event.target.value); }}>
          <option value="">Add a block…</option>
          {allow.map((name) => <option key={name} value={name}>{meta[name]!.label}</option>)}
        </select>
        <span className="hint">alt + ↑ / ↓ reorders a focused block</span>
      </div>
    </div>
  );
}

function previewLabel(block: BlockInstance, info: BlockMeta | undefined): string {
  if (!info) return block._type;
  for (const key of ["heading", "title", "question", "language", "tone"]) {
    const value = block[key];
    if (typeof value === "string" && value) return value.slice(0, 60);
  }
  const doc = block.body as { content?: { content?: { text?: string }[] }[] } | undefined;
  const first = doc?.content?.[0]?.content?.[0]?.text;
  return first ? first.slice(0, 60) : "—";
}
