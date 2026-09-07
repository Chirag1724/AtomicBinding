---
title: Webhooks
summary: Receive events instead of polling for them.
version: v2
updated: 2026-08-27
---

A webhook is an HTTP request we make to you when something happens. You register a URL,
we sign every request, and you verify the signature before trusting the body.

```ts
import { verify } from "@acme/client";

export async function POST(request: Request) {
  const body = await request.text();
  const event = verify(body, request.headers.get("acme-signature"), process.env.ACME_WEBHOOK_SECRET);
  return new Response(null, { status: 204 });
}
```

:::callout{tone=warning title="Verify before you parse"}
Parsing first and verifying second means you have already acted on an unsigned payload.
Verify against the **raw** body — a JSON round trip changes the bytes and the signature
will not match.
:::

Retries run for 24 hours with exponential backoff. Return a `2xx` quickly and do the work
afterwards; a slow handler looks identical to a failed one.

See the [quickstart](/docs/v2/quickstart) if you have not made a first call yet.
