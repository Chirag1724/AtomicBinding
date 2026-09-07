// @imprint/schema — the schema language.
//
// One definition per type drives five consumers: storage validation, the editor
// manifest, the delivery API's types, the render props, and the build gates. No codegen,
// so nothing can drift.

export * from "./values";
export * from "./types";
export { f } from "./fields";
export { zodFor, zodForField } from "./zod";
export { manifestFor, manifestForField, humanize, WIDGETS } from "./manifest";
export type { ManifestField, Widget } from "./manifest";
export * from "./props";
export * from "./binding";
export * from "./defs";
export * from "./validate";
