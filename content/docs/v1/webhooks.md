---
title: Webhooks (v1)
summary: The v1 webhook contract. Frozen; use v2 for new work.
version: v1
updated: 2025-11-02
---

:::callout{tone=deprecated title="This version is frozen"}
v1 receives security fixes only. The [v2 webhooks page](/docs/v2/webhooks) covers the
current signing scheme.
:::

v1 signed the JSON body after normalisation, which meant two byte-identical payloads
could produce different signatures. v2 signs the raw bytes.
