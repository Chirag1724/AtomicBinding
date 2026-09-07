#!/usr/bin/env tsx
// The Imprint CLI.

import { doctor } from "./commands/doctor";
import { gates } from "./commands/gates";
import { migrate } from "./commands/migrate";
import { seed } from "./commands/seed";
import { bold, dim } from "./format";

function help(): void {
  console.log(`
  ${bold("imprint")}

    ${bold("seed")} [--reset] [--legacy]   real content to look at
                                 ${dim("--reset   delete everything first")}
                                 ${dim("--legacy  add one row written against schema v1,")}
                                 ${dim("          so the migration runner has something to do")}

    ${bold("gates")} [--draft]             the six build gates; exit 1 on any failure
    ${bold("doctor")}                      sources, types, pending migrations, gates
    ${bold("migrate")} [type] [--apply]    dry run by default; --apply writes

  ${dim("Every command reads IMPRINT_SQLITE_PATH, default ./data/imprint.db")}
`);
}

const [command, ...argv] = process.argv.slice(2);

const run = async (): Promise<number> => {
  switch (command) {
    case "seed": return seed(argv);
    case "gates": return gates(argv);
    case "doctor": return doctor();
    case "migrate": return migrate(argv);
    case undefined:
    case "help":
    case "--help":
      help();
      return 0;
    default:
      console.error(`unknown command '${command}'`);
      help();
      return 2;
  }
};

run().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\n  ${(error as Error).message}\n`);
    process.exit(1);
  }
);
