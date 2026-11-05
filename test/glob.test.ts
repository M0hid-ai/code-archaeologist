import { test } from "node:test";
import assert from "node:assert/strict";
import { excludePaths, globToRegExp, parseIgnoreFile, pathMatcher } from "../src/util/glob.js";
import type { RepoHistory } from "../src/types.js";

const m = (glob: string, path: string) => globToRegExp(glob).test(path);

test("floating patterns match names at any depth", () => {
  assert.ok(m("*.min.js", "a/b/c.min.js"));
  assert.ok(m("vendor", "vendor/x.js"));
  assert.ok(m("vendor", "lib/vendor/x.js"));
  assert.ok(m("fixtures/", "test/fixtures/a.json"));
  assert.ok(!m("*.min.js", "a/b/c.js"));
});

test("anchored and double-star patterns", () => {
  assert.ok(m("/docs", "docs/a.md"));
  assert.ok(!m("/docs", "site/docs/a.md"));
  assert.ok(m("src/**/*.gen.ts", "src/a/b/c.gen.ts"));
  assert.ok(m("src/**/*.gen.ts", "src/c.gen.ts"));
  assert.ok(m("build/**", "build/x/y"));
  assert.ok(m("a?c.txt", "abc.txt"));
  assert.ok(!m("a?c.txt", "a/c.txt"));
});

test("special characters are literal", () => {
  assert.ok(m("file(1).txt", "file(1).txt"));
  assert.ok(!m("a.b", "axb"));
});

test("parseIgnoreFile skips comments and blanks", () => {
  assert.deepEqual(parseIgnoreFile("# vendored\nvendor/\n\n  *.snap  \r\n"), ["vendor/", "*.snap"]);
});

test("excludePaths removes file changes but keeps commits", () => {
  const h: RepoHistory = {
    name: "x",
    head: "h",
    branch: "main",
    tags: [],
    commits: [
      {
        hash: "1", parents: [], author: "a", email: "", time: 0, localHour: 0, localWeekday: 0, subject: "s",
        files: [
          { path: "vendor/lib.js", status: "A", added: 100, deleted: 0 },
          { path: "src/app.js", status: "A", added: 10, deleted: 0 },
        ],
      },
    ],
  };
  const out = excludePaths(h, ["vendor/"]);
  assert.equal(out.commits.length, 1);
  assert.deepEqual(out.commits[0].files.map((f) => f.path), ["src/app.js"]);
  assert.equal(excludePaths(h, []), h);
  assert.ok(pathMatcher(["*.md"])("README.md"));
});
