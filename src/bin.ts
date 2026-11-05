#!/usr/bin/env node
import { run } from "./cli.js";
import { c, endStatus } from "./util/term.js";

run(process.argv.slice(2)).then(
  // exitCode instead of process.exit(): exiting while fetch/child handles are
  // still closing trips a libuv assertion on Windows.
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    endStatus();
    console.error(c.red("error: ") + (err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  },
);
