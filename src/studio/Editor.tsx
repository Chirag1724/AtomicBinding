"use client";

// The editor. Fields from the manifest, blocks from the composer, and a preview that
// receives the in-memory draft over postMessage — no network round trip, which is the
// only way a keystroke can repaint fast enough to be useful.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlockInstance, ManifestField, Violation } from "@imprint/schema";
import { BlockComposer, type BlockMeta } from "./BlockComposer";
import { FieldRenderer, type FieldContext, type RefCandidate } from "./FieldRenderer";
import type { ActionResult } from "./actions";

export interface EditorProps {
  id: string;
  type: string;
  typeLabel: string;
  fields: ManifestField[];
  initialData: Record<string, unknown>;
  version: number;
  publishedVersion: number | null;
  routeTemplate: string | null;
  blockMeta: Record<string, BlockMeta>;
  candidates: Record<string, RefCandidate[]>;
  feeds: { name: string; label: string }[];
  versions: { version: number; createdAt: string; createdBy: string }[];
  actions: {
    save: (input: { id: string; type: string; data: Record<string, unknown>; version?: number }) => Promise<ActionResult>;
    publish: (id: string) => Promise<ActionResult>;
    unpublish: (id: string, force?: boolean) => Promise<ActionResult>;
    revert: (id: string, version: number) => Promise<ActionResult>;
  };
}

const errorsByPath = (violations: Violation[] | undefined): Record<string, string> =>
  Object.fromEntries((violations ?? []).map((v) => [v.path, v.message]));

function fillRoute(template: string | null, data: Record<string, unknown>): string | null {
  if (!template) return null;
  let ok = true;
  const filled = template.replace(/\{(\w+)\}/g, (_all, field: string) => {
    const value = data[field];
    if (typeof value !== "string" || !value) { ok = false; return ""; }
    return value;
  });
  return ok ? filled : null;
}

export function Editor(props: EditorProps) {
  const [data, setData] = useState(props.initialData);
  const [version, setVersion] = useState(props.version);
  const [publishedVersion, setPublishedVersion] = useState(props.publishedVersion);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const iframe = useRef<HTMLIFrameElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);

  const route = useMemo(() => fillRoute(props.routeTemplate, data), [props.routeTemplate, data]);
  const blocksField = props.fields.find((field) => field.widget === "blockComposer");
  const plainFields = props.fields.filter((field) => field.widget !== "blockComposer");
  const blocks = (Array.isArray(data[blocksField?.name ?? ""]) ? data[blocksField!.name] : []) as BlockInstance[];

  const ctx: FieldContext = {
    candidates: props.candidates,
    errors: errorsByPath(result?.violations),
    blockTypes: Object.values(props.blockMeta),
    feeds: props.feeds,
    source: data,
  };

  // ── the preview bridge ───────────────────────────────────────────────────────
  const post = useCallback(() => {
    iframe.current?.contentWindow?.postMessage(
      { kind: "imprint:draft", blocks, data },
      window.location.origin
    );
  }, [blocks, data]);

  useEffect(() => {
    const timer = setTimeout(post, 150); // debounced; the repaint is local
    return () => clearTimeout(timer);
  }, [post]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const message = event.data as { kind?: string; key?: string };
      if (message?.kind === "imprint:ready") post();
      if (message?.kind === "imprint:select" && message.key) {
        setSelected(message.key);
        fieldsRef.current?.querySelector(`[data-block-key="${message.key}"]`)?.scrollIntoView({ block: "center" });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  // ── actions ──────────────────────────────────────────────────────────────────
  const run = async (label: string, work: () => Promise<ActionResult>) => {
    setBusy(true);
    setStatus(`${label}…`);
    const outcome = await work();
    setResult(outcome);
    setBusy(false);
    setStatus(outcome.ok ? `${label.replace(/e?$/, "ed")}.` : "");
    return outcome;
  };

  const save = () =>
    run("Save", async () => {
      const outcome = await props.actions.save({ id: props.id, type: props.type, data, version });
      if (outcome.ok && outcome.version) setVersion(outcome.version);
      return outcome;
    });

  const publish = () =>
    run("Publish", async () => {
      const saved = await props.actions.save({ id: props.id, type: props.type, data, version });
      if (!saved.ok) return saved;
      if (saved.version) setVersion(saved.version);
      const outcome = await props.actions.publish(props.id);
      if (outcome.ok && outcome.version) setPublishedVersion(outcome.version);
      return outcome;
    });

  const hasUnpublishedChanges = publishedVersion === null || version > publishedVersion;

  return (
    <div className={`editor${showPreview ? " with-preview" : ""}`}>
      <div className="editor-main">
        <header className="editor-head">
          <div>
            <p className="eyebrow">{props.typeLabel}</p>
            <h1>{String(data[props.fields[0]?.name ?? "title"] ?? "Untitled")}</h1>
            <p className="routeline">
              {route ? <code>{route}</code> : <em>no route yet — fill the slug</em>}
              {" · "}v{version}
              {publishedVersion === null
                ? <span className="chip chip-draft">never published</span>
                : hasUnpublishedChanges
                  ? <span className="chip chip-draft">unpublished changes</span>
                  : <span className="chip chip-cms">published</span>}
            </p>
          </div>

          <div className="editor-actions">
            <button type="button" onClick={() => setShowPreview((on) => !on)} className="btn">
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
            <button type="button" onClick={save} disabled={busy} className="btn">Save draft</button>
            <button type="button" onClick={publish} disabled={busy} className="btn btn-primary">Publish</button>
            {publishedVersion !== null ? (
              <button type="button" className="btn danger" disabled={busy}
                onClick={() => run("Unpublish", () => props.actions.unpublish(props.id))}>
                Unpublish
              </button>
            ) : null}
          </div>
        </header>

        {status ? <p className="status">{status}</p> : null}

        {result && !result.ok ? (
          <div className="problem">
            <p><strong>{result.error}</strong></p>
            {result.conflict ? (
              <p>
                You loaded v{result.conflict.expected}; the draft is now v{result.conflict.actual}.
                Reload to see their changes, or save again to overwrite.
              </p>
            ) : null}
            {result.holders?.length ? (
              <ul>
                {result.holders.map((holder) => (
                  <li key={holder.id}>{holder.title} <code>{holder.route}</code></li>
                ))}
              </ul>
            ) : null}
            {result.violations?.length ? (
              <ul>
                {result.violations.map((violation, index) => (
                  <li key={index}><code>{violation.path || "(document)"}</code> {violation.message}</li>
                ))}
              </ul>
            ) : null}
            {result.holders?.length ? (
              <button type="button" className="mini danger" disabled={busy}
                onClick={() => run("Unpublish", () => props.actions.unpublish(props.id, true))}>
                Unpublish anyway
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="fields" ref={fieldsRef}>
          {plainFields.map((field) => (
            <FieldRenderer key={field.name} field={field} value={data[field.name]} path={field.name}
              ctx={ctx}
              onChange={(next) => setData((current) => ({ ...current, [field.name]: next }))} />
          ))}

          {blocksField ? (
            <BlockComposer field={blocksField} blocks={blocks} meta={props.blockMeta} ctx={ctx}
              selected={selected} onSelect={setSelected}
              onChange={(next) => setData((current) => ({ ...current, [blocksField.name]: next }))} />
          ) : null}
        </div>

        {props.versions.length > 1 ? (
          <details className="history">
            <summary>Version history ({props.versions.length})</summary>
            <ul>
              {props.versions.map((entry) => (
                <li key={entry.version}>
                  <span>v{entry.version}</span>
                  <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
                  <span className="muted">{entry.createdBy}</span>
                  <button type="button" className="mini" disabled={busy}
                    onClick={() => run("Revert", () => props.actions.revert(props.id, entry.version))}>
                    Revert to this
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {showPreview ? (
        <aside className="editor-preview">
          {route ? (
            <iframe ref={iframe} title="Preview" src={`${route}?preview=1`} />
          ) : (
            <p className="empty">Fill in the slug and the preview will open.</p>
          )}
        </aside>
      ) : null}
    </div>
  );
}
