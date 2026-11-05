import { test } from "node:test";
import assert from "node:assert/strict";
import { isCode, isDoc, isNoise, isTest, language, topDir } from "../src/util/files.js";
import { classify, isLazyMessage, isRefactor, revertedSubject } from "../src/util/messages.js";
import { downsample, hash32, median, pick } from "../src/util/stats.js";
import { humanDuration, monthKey, monthsBetween } from "../src/util/time.js";

test("file classification", () => {
  assert.ok(isNoise("package-lock.json"));
  assert.ok(isNoise("web/node_modules/x/index.js"));
  assert.ok(isNoise("assets/app.min.js"));
  assert.ok(!isNoise("src/index.ts"));
  assert.equal(language("src/a.tsx"), "TypeScript");
  assert.equal(language("Dockerfile"), "Docker");
  assert.ok(isCode("lib/x.py"));
  assert.ok(!isCode("README.md"));
  assert.ok(isTest("src/__tests__/a.js"));
  assert.ok(isTest("src/a.spec.ts"));
  assert.ok(isDoc("docs/intro.md"));
  assert.equal(topDir("src/a/b.ts"), "src");
  assert.equal(topDir("README.md"), "(root)");
});

test("commit mood classification", () => {
  assert.equal(classify("feat(api): add pagination"), "feature");
  assert.equal(classify("Fix crash when config is empty"), "fix");
  assert.equal(classify("oops, forgot a file"), "panic");
  assert.equal(classify('Revert "Add thing"'), "revert");
  assert.equal(classify("Merge pull request #12 from x/y"), "merge");
  assert.equal(classify("Refactor the router"), "refactor");
  assert.equal(classify("Bump lodash from 4.17.20 to 4.17.21"), "chore");
  assert.equal(classify("Initial import"), "other");
  assert.ok(isRefactor("refactor: split parser"));
  assert.ok(isLazyMessage("wip"));
  assert.ok(isLazyMessage("."));
  assert.ok(!isLazyMessage("Add retry logic to uploader"));
  assert.equal(revertedSubject('Revert "Add thing"'), "Add thing");
});

test("stats helpers", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(hash32("a"), hash32("a"));
  assert.notEqual(hash32("a"), hash32("b"));
  assert.equal(pick(["x", "y", "z"], "seed"), pick(["x", "y", "z"], "seed"));
  assert.deepEqual(downsample([1, 1, 1, 1], 2), [2, 2]);
  assert.deepEqual(downsample([1, 2], 5), [1, 2]);
});

test("time helpers", () => {
  const jan = Date.UTC(2023, 0, 15) / 1000;
  const apr = Date.UTC(2023, 3, 2) / 1000;
  assert.equal(monthKey(jan), "2023-01");
  assert.equal(monthsBetween(jan, apr).length, 4);
  assert.equal(humanDuration(86400 * 800), "2 years");
  assert.equal(humanDuration(86400 * 90), "3 months");
  assert.equal(humanDuration(60), "1 minute");
});
