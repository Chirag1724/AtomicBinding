// node:sqlite is newer than most bundlers' builtin lists, so a static `import` gets
// rewritten to a bare "sqlite" specifier and fails to resolve. Requiring it at runtime
// keeps the bundler out of it while the type import stays fully checked.

import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

export const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
export type DatabaseSyncInstance = InstanceType<typeof DatabaseSync>;
