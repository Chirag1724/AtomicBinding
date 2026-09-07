// Renders a node's blocks, resolving each block's binding against the same root the
// gates checked. Used by the site AND by the studio preview, so there is one rendering
// path and preview cannot drift from production.

import { resolveBinding, type BlockInstance, type Row } from "@imprint/schema";
import { registry } from "~/schema";
import { componentFor } from "./blocks";

export interface BlockListProps {
  blocks: BlockInstance[];
  /** The resolution root: every declared feed, plus the document's own data. */
  root: Record<string, unknown>;
  /** In preview, each block carries its `_key` so a click can select it. */
  preview?: boolean;
}

export function rowsFor(instance: BlockInstance): Row[] {
  const stored = instance._binding;
  if (Array.isArray(stored)) return stored as Row[];
  // No stored rows: fall back to what the block binds by default when it is added.
  return registry.blocks[instance._type]?.rows ?? [];
}

export function BlockList({ blocks, root, preview }: BlockListProps) {
  return (
    <>
      {blocks.map((instance) => {
        const Component = componentFor(instance);

        if (!Component) {
          // A saved document names a block nothing registers. It is a gate failure, but
          // it must not blank the page — say so where the block would have been.
          return (
            <div className="block missing" key={instance._key} data-imprint-key={preview ? instance._key : undefined}>
              <p>No block type <code>{instance._type}</code> is registered. The document still names it.</p>
            </div>
          );
        }

        const rows = rowsFor(instance);
        const items = rows.length ? resolveBinding(rows, root) : undefined;
        const props: Record<string, unknown> = { ...instance, items };

        return (
          <div
            key={instance._key}
            data-imprint-key={preview ? instance._key : undefined}
            className={preview ? "previewable" : undefined}
          >
            <Component {...props} />
          </div>
        );
      })}
    </>
  );
}
