import { describe, expect, it } from "vitest";
import {
  defineBlock, defineDocument, defineRegistry, extractLinks, extractRefs, f,
  manifestFor, routeFor, validateDocument, WIDGETS,
} from "@imprint/schema";
import { registry } from "~/schema";

describe("one definition, several consumers", () => {
  const doc = defineDocument({
    name: "widget",
    label: "Widget",
    titleField: "name",
    route: "/widgets/{slug}",
    section: "marketing",
    fields: {
      name: f.text({ required: true, max: 10 }),
      slug: f.slug({ required: true, from: "name" }),
      note: f.textArea(),
    },
  });

  it("produces a validator", () => {
    expect(doc.zod.safeParse({ name: "Hi", slug: "hi" }).success).toBe(true);
    expect(doc.zod.safeParse({ name: "Hi" }).success).toBe(false);
    expect(doc.zod.safeParse({ name: "way too long a name", slug: "hi" }).success).toBe(false);
  });

  it("produces an editor manifest from the same fields", () => {
    expect(doc.manifest.map((m) => [m.name, m.widget, m.required])).toEqual([
      ["name", "input", true],
      ["slug", "slugInput", true],
      ["note", "textarea", false],
    ]);
  });

  it("labels a field from its name when it declares none", () => {
    const [seoTitle] = manifestFor({ seoTitle: f.text() });
    expect(seoTitle!.label).toBe("Seo title");
  });

  it("maps every field kind to exactly one widget", () => {
    const kinds = Object.keys(WIDGETS);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("fills a route template from the data", () => {
    expect(routeFor(doc, { slug: "acme" })).toBe("/widgets/acme");
    expect(() => routeFor(doc, {})).toThrow(/route needs 'slug'/);
  });
});

describe("the design rules the language enforces", () => {
  it("refuses a block that holds blocks", () => {
    expect(() =>
      defineBlock({
        name: "nested",
        label: "Nested",
        fields: { inner: f.blocks({ allow: ["callout"] }) },
      })
    ).toThrow(/cannot hold a blocks field/);
  });

  it("refuses a routable singleton", () => {
    expect(() =>
      defineDocument({
        name: "nav", label: "Nav", titleField: "label", section: "marketing",
        singleton: true, route: "/nav",
        fields: { label: f.text({ required: true }) },
      })
    ).toThrow(/a singleton has no route/);
  });

  it("refuses two document types with one name", () => {
    const one = defineDocument({ name: "dup", label: "A", titleField: "t", section: "marketing", fields: { t: f.text() } });
    expect(() => defineRegistry({ documents: [one, one], blocks: [], feeds: {}, ownership: { "/": "cms" } }))
      .toThrow(/duplicate document type 'dup'/);
  });
});

describe("ownership", () => {
  it("resolves a route to exactly one source, longest prefix first", () => {
    expect(registry.ownerOf("/docs/v2/webhooks")).toBe("git");
    expect(registry.ownerOf("/integrations/stripe")).toBe("cms");
    expect(registry.ownerOf("/pricing")).toBe("cms");
  });
});

describe("validate on read", () => {
  const doc = registry.document("integration");

  it("reports every violation rather than throwing", () => {
    const result = validateDocument(doc, { name: "Stripe" }, registry);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.path)).toContain("slug");
    expect(result.violations.map((v) => v.path)).toContain("logo");
  });

  it("names the block, the index and the field when a block is invalid", () => {
    const result = validateDocument(
      registry.document("marketingPage"),
      {
        title: "Home", slug: "home",
        body: [{ _type: "callout", _key: "k1", tone: "screaming" }],
      },
      registry
    );
    expect(result.violations.some((v) => v.path.startsWith("body[0].tone"))).toBe(true);
  });

  it("flags a block type nothing registers, instead of crashing", () => {
    const result = validateDocument(
      registry.document("marketingPage"),
      { title: "Home", slug: "home", body: [{ _type: "hero", _key: "k1", heading: "Hi" }] },
      registry
    );
    expect(result.ok).toBe(true);
  });

  it("flags duplicate block keys", () => {
    const result = validateDocument(
      registry.document("marketingPage"),
      {
        title: "Home", slug: "home",
        body: [
          { _type: "hero", _key: "same", heading: "A" },
          { _type: "hero", _key: "same", heading: "B" },
        ],
      },
      registry
    );
    expect(result.violations.some((v) => v.message.includes("duplicate _key"))).toBe(true);
  });
});

describe("extraction", () => {
  it("pulls every reference with the field path that held it", () => {
    const refs = extractRefs(registry.document("release").fields, {
      changes: [{ _ref: "c1", _source: "cms" }, { _ref: "c2", _source: "cms" }],
      affects: [{ _ref: "/docs/v2/webhooks", _source: "git" }],
    });
    expect(refs.map((r) => r.path)).toEqual(["changes[0]", "changes[1]", "affects[0]"]);
    expect(refs[2]!.to).toBe("docsPage");
    expect(refs[2]!._source).toBe("git");
  });

  it("pulls internal links out of rich text and link fields, never declared", () => {
    const links = extractLinks({
      action: { label: "Docs", href: "/docs/v2/webhooks" },
      body: {
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "see this", marks: [{ type: "link", attrs: { href: "/pricing" } }] }],
        }],
      },
      external: { label: "x", href: "https://example.com" },
    });
    expect(links).toEqual(["/docs/v2/webhooks", "/pricing"]);
  });
});
