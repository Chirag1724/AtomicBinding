// GET /api/graph?variant= — the full export, streamed as NDJSON.
//
// One JSON object per line, so a build can consume it without holding the whole graph in
// memory, and so a 500-node site is a stream rather than a spike.

import { authorised, DRAFT_HEADERS } from "@/lib/auth";
import { siteGraph } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const variant = new URL(request.url).searchParams.get("variant");

  if (variant !== "draft" && variant !== "published") {
    return Response.json({ error: "variant is required" }, { status: 400 });
  }
  if (variant === "draft" && !authorised(request)) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }

  const graph = await siteGraph(variant);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      for (const node of graph.nodes) {
        controller.enqueue(encoder.encode(`${JSON.stringify(node)}\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      ...(variant === "draft" ? DRAFT_HEADERS : {}),
    },
  });
}
