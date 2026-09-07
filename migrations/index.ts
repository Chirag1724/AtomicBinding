// Migrations.
//
// Additive changes need none: a new optional field leaves every stored document valid.
// A RENAME or a type change does, because documents already in the database were
// written against the old shape and validate-on-read will flag every one of them.

export interface Migration {
  type: string;
  from: number;
  to: number;
  describe(): string;
  up(data: Record<string, unknown>): Record<string, unknown>;
}

/**
 * integration v1 -> v2: `blurb` became `summary`.
 *
 * Idempotent on purpose. A migration that has already run must be safe to run again,
 * because the only way to be sure it ran everywhere is to run it everywhere.
 */
export const integrationBlurbToSummary: Migration = {
  type: "integration",
  from: 1,
  to: 2,
  describe: () => "integration: rename `blurb` to `summary`",
  up(data) {
    if (!("blurb" in data)) return data;
    const { blurb, ...rest } = data;
    return { ...rest, summary: rest.summary ?? blurb };
  },
};

export const MIGRATIONS: Migration[] = [integrationBlurbToSummary];

/** The chain that takes a document from `from` to the newest version we know about. */
export function migrationsFor(type: string, from: number): Migration[] {
  const chain: Migration[] = [];
  let at = from;
  for (;;) {
    const next = MIGRATIONS.find((m) => m.type === type && m.from === at);
    if (!next) return chain;
    chain.push(next);
    at = next.to;
  }
}
