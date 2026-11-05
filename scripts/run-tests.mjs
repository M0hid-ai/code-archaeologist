// Cross-platform test launcher: node --test with an explicit file list
// (directory and glob arguments behave differently across Node 20/22/24).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = join("dist", "test");
const files = readdirSync(dir).filter((f) => f.endsWith(".test.js")).map((f) => join(dir, f));
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
