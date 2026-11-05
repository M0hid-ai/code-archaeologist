import { test } from "node:test";
import assert from "node:assert/strict";
import { readHistory } from "../src/git/history.js";
import { analyze } from "../src/analysis/index.js";
import { storyRepo } from "./fixture.js";

test("analyze builds a complete catalogue for a small repo", async () => {
  const repo = storyRepo();
  try {
    const h = await readHistory(repo.dir);
    const r = await analyze(h, { repoDir: repo.dir });

    assert.equal(r.overview.commits, 7);
    assert.equal(r.overview.contributors, 3);
    assert.equal(r.overview.filesDead, 1);
    assert.ok(r.overview.linesAlive > 0);

    assert.ok(r.months.length >= 6);
    assert.ok(r.eras.length >= 1);
    assert.equal(r.eras[0].name, "The Founding");

    assert.equal(r.graveyard.total, 1);
    assert.equal(r.graveyard.tombstones[0].killedBy, "Grace");
    assert.equal(r.graveyard.zombies.length, 1);

    const boot = r.survivors.functions.find((f) => f.name === "boot");
    assert.ok(boot, "boot() should be a survivor");
    assert.equal(boot.bornBy, "Ada");
    assert.ok(boot.refactorsSurvived >= 1);

    const ada = r.contributors.find((c) => c.name === "Ada");
    assert.ok(ada?.archetypes.some((a) => a.id === "founder"));

    assert.equal(r.rhythm.heatmap.length, 7);
    assert.ok(r.milestones.some((m) => m.kind === "genesis"));
    assert.ok(r.milestones.some((m) => m.kind === "release"));
    assert.equal(r.timelapse.frames.length, r.months.length);
    assert.ok(r.timelapse.frames.at(-1)!.totalFiles >= 4);
    assert.equal(r.archive[0].a, "Linus");

    assert.equal(r.narrative.source, "offline");
    assert.ok(r.narrative.prologue.includes("Ada"));
    assert.equal(r.narrative.eras.length, r.eras.length);
  } finally {
    repo.cleanup();
  }
});
