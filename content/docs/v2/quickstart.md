---
title: Quickstart
summary: Send your first request in about four minutes.
version: v2
updated: 2026-08-14
---

Install the client, set your key, make a call. The whole surface is one function until
you need [webhooks](/docs/v2/webhooks).

```bash
npm install @acme/client
export ACME_KEY=sk_live_...
```

Then call it:

```ts
import { Acme } from "@acme/client";

const acme = new Acme(process.env.ACME_KEY);
const invoice = await acme.invoices.create({ amount: 4200, currency: "gbp" });
```

:::callout{tone=warning title="Keys are environment-scoped"}
A test key against the live host returns `401`, and the message names neither the key nor
the host. Check both before you check your code.
:::
