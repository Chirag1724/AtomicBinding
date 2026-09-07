import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, openSqliteStore, RouteConflictError, type Store } from "@imprint/store";

let store: Store;
const BY = "editor-1";

const save = (id: string, data: Record<string, unknown>, route: string | null = null, expected?: number) =>
  store.save({ id, type: "marketingPage", route, data, schemaVer: 1, updatedBy: BY, expectedVersion: expected });

beforeEach(() => {
  store = openSqliteStore(":memory:");
});

describe("the two-row model", () => {
  it("creates a draft at version 1 and no published row", () => {
    const draft = save("a", { title: "Pricing" }, "/pricing");
    expect(draft.version).toBe(1);
    expect(store.get("a", "published")).toBeNull();
  });

  it("publishing copies the draft, leaving both rows equal", () => {
    save("a", { title: "Pricing" }, "/pricing");
    const published = store.publish("a", BY);
    expect(published.version).toBe(1);
    expect(published.data).toEqual({ title: "Pricing" });
    expect(store.get("a", "draft")!.version).toBe(published.version);
  });

  it("'has unpublished changes' is a comparison, not a stored flag", () => {
    save("a", { title: "Pricing" }, "/pricing");
    store.publish("a", BY);
    save("a", { title: "Pricing 2026" }, "/pricing", 1);

    const draft = store.get("a", "draft")!;
    const published = store.get("a", "published")!;
    expect(draft.version).toBeGreaterThan(published.version);
  });

  it("unpublishing removes the published row and leaves the draft", () => {
    save("a", { title: "Pricing" }, "/pricing");
    store.publish("a", BY);
    store.unpublish("a");
    expect(store.get("a", "published")).toBeNull();
    expect(store.get("a", "draft")).not.toBeNull();
  });
});

describe("optimistic locking", () => {
  it("rejects a save against a stale version and names the other editor", () => {
    save("a", { title: "One" });
    save("a", { title: "Two" }, null, 1);

    try {
      save("a", { title: "Three" }, null, 1);
      throw new Error("expected a conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      const conflict = error as ConflictError;
      expect(conflict.expected).toBe(1);
      expect(conflict.actual).toBe(2);
      expect(conflict.message).toContain(BY);
    }
  });

  it("accepts a save that carries the current version", () => {
    save("a", { title: "One" });
    expect(save("a", { title: "Two" }, null, 1).version).toBe(2);
  });
});

describe("route uniqueness", () => {
  it("is a database error, not a code bug", () => {
    save("a", { title: "Pricing" }, "/pricing");
    store.publish("a", BY);
    save("b", { title: "Also pricing" }, "/pricing");

    expect(() => store.publish("b", BY)).toThrow(RouteConflictError);
  });

  it("lets two DRAFTS share a route — only publishing is exclusive", () => {
    save("a", { title: "Pricing" }, "/pricing");
    save("b", { title: "Also pricing" }, "/pricing");
    expect(store.all("draft")).toHaveLength(2);
  });
});

describe("versions and revert", () => {
  it("appends a version row per save", () => {
    save("a", { title: "One" });
    save("a", { title: "Two" }, null, 1);
    save("a", { title: "Three" }, null, 2);
    expect(store.versions("a").map((v) => v.version)).toEqual([3, 2, 1]);
  });

  it("reverts by copying an old version forward as a new draft", () => {
    save("a", { title: "One" });
    save("a", { title: "Two" }, null, 1);
    const reverted = store.revert("a", 1, BY);

    expect(reverted.data).toEqual({ title: "One" });
    expect(reverted.version).toBe(3); // forward, never backwards
  });
});

describe("the inbound index", () => {
  it("answers 'what points at this' without a full scan", () => {
    store.save({
      id: "release-1", type: "release", route: "/releases/2-4-0", data: { title: "2.4.0" },
      schemaVer: 1, updatedBy: BY,
      refs: [{ _ref: "/docs/v2/webhooks", _source: "git", path: "affects[0]", to: "docsPage" }],
    });
    store.publish("release-1", BY);

    const holders = store.inbound("/docs/v2/webhooks");
    expect(holders.map((h) => h.id)).toEqual(["release-1"]);
  });

  it("drops the published refs when a document is unpublished", () => {
    store.save({
      id: "release-1", type: "release", route: "/releases/2-4-0", data: { title: "2.4.0" },
      schemaVer: 1, updatedBy: BY,
      refs: [{ _ref: "/docs/v2/webhooks", _source: "git", path: "affects[0]", to: "docsPage" }],
    });
    store.publish("release-1", BY);
    store.unpublish("release-1");
    expect(store.inbound("/docs/v2/webhooks")).toHaveLength(0);
  });
});

describe("pagination", () => {
  it("pages with a cursor and offers no total", () => {
    for (let index = 0; index < 5; index += 1) save(`doc-${index}`, { title: `Doc ${index}` });

    const first = store.list({ variant: "draft", limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    expect(first).not.toHaveProperty("total");

    const second = store.list({ variant: "draft", limit: 2, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(2);
    const ids = new Set([...first.items, ...second.items].map((d) => d.id));
    expect(ids.size).toBe(4);
  });
});

describe("migration rewrites", () => {
  it("rewrites every variant and records a revertible version", () => {
    save("a", { name: "Stripe" });
    store.publish("a", BY);

    const changes = store.rewrite(
      "marketingPage",
      (data) => ({ title: data.name, ...Object.fromEntries(Object.entries(data).filter(([k]) => k !== "name")) }),
      2,
      "admin"
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]!.before).toEqual({ name: "Stripe" });
    expect(store.get("a", "draft")!.data).toEqual({ title: "Stripe" });
    expect(store.get("a", "published")!.data).toEqual({ title: "Stripe" });
    expect(store.get("a", "draft")!.schemaVer).toBe(2);
    expect(store.versions("a").some((v) => v.schemaVer === 2)).toBe(true);
  });
});
