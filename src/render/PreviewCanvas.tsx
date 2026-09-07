"use client";

// The preview bridge.
//
// The studio posts its IN-MEMORY draft on every keystroke, debounced. There is no
// network round trip, which is the only way a keystroke can repaint in under 200ms.
// Clicking a block posts its `_key` back so the studio can scroll to those fields.

import { useEffect, useState } from "react";
import type { BlockInstance } from "@imprint/schema";
import { BlockList } from "./BlockList";

interface DraftMessage {
  kind: "imprint:draft";
  blocks: BlockInstance[];
  data: Record<string, unknown>;
}

export function PreviewCanvas({
  initialBlocks,
  root,
  studioOrigin,
}: {
  initialBlocks: BlockInstance[];
  root: Record<string, unknown>;
  studioOrigin: string;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [live, setLive] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // The studio origin is allowlisted, and verified on EVERY message.
      if (event.origin !== studioOrigin && event.origin !== window.location.origin) return;
      const message = event.data as DraftMessage | undefined;
      if (message?.kind !== "imprint:draft") return;
      setBlocks(message.blocks);
      setLive(true);
    }

    function onClick(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest("[data-imprint-key]");
      const key = target?.getAttribute("data-imprint-key");
      if (!key) return;
      event.preventDefault();
      window.parent.postMessage({ kind: "imprint:select", key }, studioOrigin);
    }

    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick);
    window.parent.postMessage({ kind: "imprint:ready" }, studioOrigin);

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick);
    };
  }, [studioOrigin]);

  return (
    <div className="preview-root">
      <p className="preview-flag">
        Preview · {live ? "showing unsaved edits" : "showing the saved draft"} · not indexed
      </p>
      <BlockList blocks={blocks} root={root} preview />
    </div>
  );
}
