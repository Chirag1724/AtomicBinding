import { describe, expect, it } from "vitest";
import { bind, compile, decompile, defineFeed, p, resolveBinding, roundTrips, s } from "@imprint/schema";

const articleItem = {
  title: s.text(),
  summary: s.text(),
  legacy_url: s.route(),
  "media_file_banner.path": s.imagePath(),
  "media_file_banner.absolute_path": s.imageUrl(),
  "primary_category.name": s.text(),
} as const;

const sportsRow = defineFeed({ name: "sports_row", container: "results", item: articleItem });
const flatFeed = defineFeed({ name: "flat_feed", item: articleItem });

const card = {
  title: p.text({ required: true }),
  image: p.imageUrl(),
  href: p.route({ required: true }),
} as const;

describe("the binding compiler", () => {
  it("compiles a card rule into one row per card per prop", () => {
    const rows = compile(
      bind(sportsRow, card).cards(3).map({
        title: (i) => i.title,
        image: (i) => i.media_file_banner.absolute_path,
      })
    );

    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({ source: "sports_row.results.0.title", target: "title" });
    expect(rows[3]).toEqual({
      source: "sports_row.results.1.media_file_banner.absolute_path",
      target: "image",
    });
  });

  it("handles a feed with no container", () => {
    const rows = compile(bind(flatFeed, card).cards(2).map({ title: (i) => i.title }));
    expect(rows.map((r) => r.source)).toEqual(["flat_feed.0.title", "flat_feed.1.title"]);
  });

  it("rejects a path the feed does not declare, and suggests the nearest", () => {
    expect(() =>
      // @ts-expect-error 'headline' is not a declared path on this feed
      bind(sportsRow, card).cards(1).map({ title: (i) => i.headline })
    ).toThrow(/declares no path 'headline'/);
  });

  it("rejects a brand mismatch: an ImagePath cannot fill an ImageUrl prop", () => {
    expect(() =>
      // @ts-expect-error ImagePath is not assignable to the ImageUrl prop 'image'
      bind(sportsRow, card).cards(1).map({ image: (i) => i.media_file_banner.path })
    ).toThrow(/is imagePath, but prop 'image' is imageUrl/);
  });

  it("rejects a target that is not a prop of the card", () => {
    expect(() =>
      // @ts-expect-error 'headline' is not a prop of this card shape
      bind(sportsRow, card).cards(1).map({ headline: (i) => i.title })
    ).toThrow(/not a prop of this card shape/);
  });
});

describe("round-tripping (S4)", () => {
  const shapes = [
    bind(sportsRow, card).cards(1).map({ title: (i) => i.title }),
    bind(sportsRow, card).cards(6).map({ title: (i) => i.title, href: (i) => i.legacy_url }),
    bind(flatFeed, card).cards(4).map({ image: (i) => i.media_file_banner.absolute_path }),
    bind(sportsRow, card).replicate().map({ title: (i) => i.title, href: (i) => i.legacy_url }),
  ];

  it("reproduces every shape the compiler emits", () => {
    for (const def of shapes) {
      const rows = compile(def);
      expect(roundTrips(rows), JSON.stringify(rows[0])).toBe(true);
      expect(compile(decompile(rows))).toEqual(rows);
    }
  });

  it("reads back the card count and the per-card rule", () => {
    const rows = compile(bind(sportsRow, card).cards(3).map({ title: (i) => i.title }));
    const def = decompile(rows);
    expect(def.feed).toBe("sports_row");
    expect(def.container).toBe("results");
    expect(def.cards).toBe(3);
    expect(def.rule).toEqual([{ target: "title", path: "title" }]);
  });

  it("recognises rows with no feed prefix as a self binding", () => {
    const def = decompile([{ source: "summary", target: "title" }]);
    expect(def.mode).toBe("self");
    expect(def.feed).toBeNull();
  });

  it("refuses rows with gaps in their card indices", () => {
    expect(() =>
      decompile([
        { source: "sports_row.results.0.title", target: "title" },
        { source: "sports_row.results.2.title", target: "title" },
      ])
    ).toThrow(/gaps in its card indices/);
  });
});

describe("resolution", () => {
  const root = {
    sports_row: {
      results: [
        { title: "One", media_file_banner: { absolute_path: "https://cdn/1.png" } },
        { title: "Two", media_file_banner: { absolute_path: "https://cdn/2.png" } },
        { title: "Three", media_file_banner: { absolute_path: "https://cdn/3.png" } },
      ],
    },
  };

  it("fills one card per bound index", () => {
    const rows = compile(bind(sportsRow, card).cards(2).map({ title: (i) => i.title }));
    expect(resolveBinding(rows, root)).toEqual([{ title: "One" }, { title: "Two" }]);
  });

  it("replicates a one-card rule across every item the feed returned", () => {
    const rows = compile(bind(sportsRow, card).replicate().map({
      title: (i) => i.title,
      image: (i) => i.media_file_banner.absolute_path,
    }));

    expect(rows).toHaveLength(2); // the rule is stored once
    const cards = resolveBinding(rows, root);
    expect(cards).toHaveLength(3); // and applied three times
    expect(cards[2]).toEqual({ title: "Three", image: "https://cdn/3.png" });
  });

  it("yields nothing for an empty rule, rather than an empty-looking card", () => {
    expect(resolveBinding([], root)).toEqual([]);
  });

  it("resolves a feed stored under a different name via an alias", () => {
    const rows = compile(bind(sportsRow, card).replicate().map({ title: (i) => i.title }));
    const misspelt = { sprots_row: root.sports_row };
    expect(resolveBinding(rows, misspelt, { aliases: { sports_row: "sprots_row" } })).toHaveLength(3);
  });
});
