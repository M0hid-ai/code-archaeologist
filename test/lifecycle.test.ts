import { test } from "node:test";
import assert from "node:assert/strict";
import { readHistory } from "../src/git/history.js";
import { canonicalAuthors, isBot } from "../src/analysis/identity.js";
import { trackLifecycles } from "../src/analysis/lifecycle.js";
import type { Commit } from "../src/types.js";
import { storyRepo } from "./fixture.js";

const commit = (author: string, email: string): Commit => ({
  hash: Math.random().toString(16).slice(2),
  parents: [],
  author,
  email,
  time: 0,
  localHour: 0,
  localWeekday: 0,
  subject: "x",
  files: [],
});

test("canonicalAuthors merges aliases sharing an email or a name", () => {
  const map = canonicalAuthors([
    commit("Ada Lovelace", "ada@home.org"),
    commit("Ada Lovelace", "ada@work.com"),
    commit("ada", "ada@work.com"),
    commit("Grace", "grace@navy.mil"),
    commit("Someone", "root@localhost"),
    commit("Other", "root@localhost"),
  ]);
  assert.equal(map.get("ada"), "Ada Lovelace");
  assert.equal(map.get("Grace"), "Grace");
  assert.equal(map.get("Someone"), "Someone");
  assert.equal(map.get("Other"), "Other");
});

test("isBot spots automation accounts", () => {
  assert.ok(isBot("dependabot[bot]"));
  assert.ok(isBot("renovate-bot"));
  assert.ok(!isBot("Robert"));
});

test("trackLifecycles follows renames, deaths and resurrections", async () => {
  const repo = storyRepo();
  try {
    const h = await readHistory(repo.dir);
    const frameTimes = [h.commits[2].time, h.commits[6].time + 1];
    const lc = trackLifecycles(h.commits, frameTimes);
    const utils = lc.alive.find((l) => l.path === "lib/utils.js");
    assert.ok(utils);
    assert.deepEqual(utils.formerNames, ["src/utils.js"]);
    assert.equal(utils.bornBy, "Ada");

    assert.equal(lc.dead.length, 1);
    const legacy = lc.dead[0];
    assert.equal(legacy.path, "src/legacy.js");
    assert.equal(legacy.died?.by, "Grace");
    assert.equal(legacy.died?.linesAtDeath, 40);

    const zombie = lc.alive.find((l) => l.path === "src/legacy.js");
    assert.equal(zombie?.resurrectionOf, legacy.id);

    const core = lc.alive.find((l) => l.path === "src/core.js");
    assert.equal(core?.touches.length, 3);
    assert.equal(core?.authors.size, 2);

    assert.equal(lc.frames.length, 2);
    // Before commit #3 only the first two commits' 4 files exist.
    assert.equal(lc.frames[0].length / 2, 4);
  } finally {
    repo.cleanup();
  }
});
