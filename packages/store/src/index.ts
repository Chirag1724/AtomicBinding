// @imprint/store — the content service.

export * from "./driver";
export { openSqliteStore, DDL } from "./sqlite";

import { openSqliteStore } from "./sqlite";
import type { Store } from "./driver";

let cached: Store | null = null;

/**
 * The process-wide store. Cached because the SQLite driver holds a file handle and
 * Next re-imports modules per request in dev.
 */
export function openStore(): Store {
  if (cached) return cached;
  const driver = process.env.IMPRINT_DRIVER ?? "sqlite";
  if (driver !== "sqlite") {
    throw new Error(
      `IMPRINT_DRIVER='${driver}' is not wired up. The Postgres DDL is committed at ` +
        `packages/store/src/postgres.sql; the driver behind this interface is the port.`
    );
  }
  cached = openSqliteStore(process.env.IMPRINT_SQLITE_PATH ?? "./data/imprint.db");
  return cached;
}

export function resetStoreCache(): void {
  cached?.close();
  cached = null;
}
