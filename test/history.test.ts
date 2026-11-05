import { test } from "node:test";
import assert from "node:assert/strict";
import { readHistory } from "../src/git/history.js";
import { storyRepo } from "./fixture.js";

test("readHistory walks a real repository oldest-first", async () => {
  const repo = storyRepo();
  try {
    const h = await readHistory(repo.dir);
    assert.equal(h.commits.length, 7);
    assert.equal(h.commits[0].subject, "Initial commit");
    assert.equal(h.commits.at(-1)?.author, "Linus");
    assert.deepEqual(
      h.tags.map((t) => t.name),
      ["v0.1.0", "v1.0.0"],
    );
    const removal = h.commits.find((c) => c.subject === "Remove legacy module");
    assert.equal(removal?.files[0].status, "D");
    assert.equal(removal?.files[0].deleted, 40);
    const move = h.commits.find((c) => c.subject === "Move utils to lib");
    assert.equal(move?.files[0].status, "R");
    assert.equal(move?.files[0].oldPath, "src/utils.js");
    assert.equal(h.commits[1].localHour, 23);
  } finally {
    repo.cleanup();
  }
});

test("readHistory honours maxCommits", async () => {
  const repo = storyRepo();
  try {
    const h = await readHistory(repo.dir, { maxCommits: 3 });
    assert.equal(h.commits.length, 3);
    assert.equal(h.commits.at(-1)?.author, "Linus");
  } finally {
    repo.cleanup();
  }
});
