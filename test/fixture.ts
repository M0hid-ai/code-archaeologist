import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface Step {
  author: string;
  /** ISO timestamp with offset, e.g. 2023-01-02T10:00:00+00:00 */
  date: string;
  message: string;
  write?: Record<string, string>;
  remove?: string[];
  rename?: [string, string][];
  tag?: string;
}

/** Build a throwaway git repository from a scripted list of commits. */
export function makeRepo(steps: Step[]): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "codearch-"));
  const run = (args: string[], env: Record<string, string> = {}) =>
    execFileSync("git", args, { cwd: dir, env: { ...process.env, ...env }, stdio: "pipe" });
  run(["init", "-q", "-b", "main"]);
  run(["config", "user.name", "Fixture"]);
  run(["config", "user.email", "fixture@example.com"]);
  run(["config", "commit.gpgsign", "false"]);
  for (const s of steps) {
    for (const [file, content] of Object.entries(s.write ?? {})) {
      const full = join(dir, file);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    for (const [from, to] of s.rename ?? []) {
      mkdirSync(dirname(join(dir, to)), { recursive: true });
      run(["mv", from, to]);
    }
    for (const file of s.remove ?? []) run(["rm", "-q", file]);
    run(["add", "-A"]);
    const email = `${s.author.toLowerCase().replace(/\s+/g, ".")}@example.com`;
    run(["commit", "-q", "--allow-empty", "-m", s.message], {
      GIT_AUTHOR_NAME: s.author,
      GIT_AUTHOR_EMAIL: email,
      GIT_AUTHOR_DATE: s.date,
      GIT_COMMITTER_NAME: s.author,
      GIT_COMMITTER_EMAIL: email,
      GIT_COMMITTER_DATE: s.date,
    });
    if (s.tag) run(["tag", s.tag]);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** n lines of distinct filler text. */
export const lines = (n: number, prefix = "line") =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i}`).join("\n") + "\n";

/** A small but eventful history used by several test files. */
export function storyRepo() {
  return makeRepo([
    {
      author: "Ada",
      date: "2022-01-03T09:00:00+00:00",
      message: "Initial commit",
      write: { "README.md": "# demo\n", "src/core.js": "function boot() {\n  return 1;\n}\n" + lines(20) },
    },
    {
      author: "Ada",
      date: "2022-01-10T23:30:00+00:00",
      message: "Add utils",
      write: { "src/utils.js": "function helper() {}\n" + lines(30, "u"), "src/legacy.js": lines(40, "legacy") },
      tag: "v0.1.0",
    },
    {
      author: "Grace",
      date: "2022-02-01T14:00:00+00:00",
      message: "fix: crash in boot",
      write: { "src/core.js": "function boot() {\n  return 2;\n}\n" + lines(22) },
    },
    {
      author: "Ada",
      date: "2022-02-02T10:00:00+00:00",
      message: "refactor core",
      write: { "src/core.js": "function boot() {\n  return 3;\n}\n" + lines(25) },
    },
    {
      author: "Grace",
      date: "2022-02-03T11:00:00+00:00",
      message: "Remove legacy module",
      remove: ["src/legacy.js"],
    },
    {
      author: "Grace",
      date: "2022-06-04T11:00:00+00:00",
      message: "Move utils to lib",
      rename: [["src/utils.js", "lib/utils.js"]],
      tag: "v1.0.0",
    },
    {
      author: "Linus",
      date: "2022-06-05T02:00:00+00:00",
      message: "Bring legacy back (oops)",
      write: { "src/legacy.js": lines(10, "zombie") },
    },
  ]);
}
