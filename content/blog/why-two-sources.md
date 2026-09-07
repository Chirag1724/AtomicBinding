---
title: Why we author docs and marketing in different places
summary: Two content populations with opposite requirements, and one graph over both.
author: The platform team
updated: 2026-09-02
---

Engineers need docs versioned with code, reviewed in pull requests and blameable. Any
system that separates a docs change from the code change that caused it produces stale
docs inside a week.

Marketers need to compose and publish page layouts without a deploy, on their own
schedule, with visual feedback.

Every single-system answer fails one of them. What we built instead keeps both authoring
surfaces and merges them into one typed graph, so [the integrations directory](/integrations)
can reference [a docs page](/docs/v2/webhooks) and be told immediately when it moves.
