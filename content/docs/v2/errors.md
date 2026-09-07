---
title: Error reference
summary: Every status the API returns, and what to do about each.
version: v2
updated: 2026-07-30
---

Errors are HTTP statuses with a machine-readable `code` and a message written for a
person. The message may change; the code will not.

:::callout{tone=note title="401 names no value on purpose"}
An authentication failure never echoes the credential back, not even partially. That is
also why it cannot tell you *which* of the key and the host is wrong.
:::

A `409` on a write means someone saved first. Reload, look at what they changed, and
decide — the API will not merge for you.
