import { test } from "node:test";
import assert from "node:assert/strict";
import { trackLifecycles } from "../src/analysis/lifecycle.js";
import { buildGraveyard, causeOfDeath, epitaph } from "../src/analysis/graveyard.js";
import { earthquakes, hotspots, reverts, rivalries } from "../src/analysis/battlefield.js";
import { buildCouplings } from "../src/analysis/coupling.js";
import { buildRhythm } from "../src/analysis/rhythm.js";
import { buildMilestones, notableTags } from "../src/analysis/milestones.js";
import { buildContributors } from "../src/analysis/contributors.js";
import { frameWindows } from "../src/analysis/timelapse.js";
import { at, commit } from "./helpers.js";

test("causeOfDeath reads the fatal commit message", () => {
  const life = trackLifecycles([commit("a", at(2020, 1), "add", [["A", "src/x.js", 10]])]).all[0];
  assert.equal(causeOfDeath("Refactor the router", life), "Lost in a refactor");
  assert.equal(causeOfDeath("Migrate to TypeScript", life), "Replaced by a successor");
  assert.equal(causeOfDeath("Remove unused helpers", life), "Died of old age");
  assert.equal(causeOfDeath("cleanup", life), "Swept away in a cleanup");
  assert.equal(causeOfDeath('Revert "add x"', life), "Reverted out of existence");
  assert.equal(causeOfDeath("whatever", life), "Stillborn: never edited after birth");
});

test("graveyard tombstones carry killer, epitaph and last words", () => {
  const commits = [
    commit("Ada", at(2020, 1), "Add legacy parser", [["A", "src/legacy.js", 1200]]),
    commit("Bob", at(2020, 6), "Speed up legacy parser", [["M", "src/legacy.js", 10, 5]]),
    commit("Cy", at(2021, 1), "Remove legacy parser", [["D", "src/legacy.js", 0, 1205]]),
    commit("Cy", at(2021, 1, 2), "Remove lockfile", [["D", "package-lock.json", 0, 9000]]),
  ];
  const lc = trackLifecycles(commits);
  const g = buildGraveyard(commits, lc);
  assert.equal(g.total, 1, "noise files are not buried");
  const t = g.tombstones[0];
  assert.equal(t.killedBy, "Cy");
  assert.equal(t.bornBy, "Ada");
  assert.equal(t.lastWords, "Speed up legacy parser");
  assert.equal(t.cause, "Died of old age");
  assert.ok(t.epitaph.includes("legacy.js"));
  assert.equal(g.reapers[0].name, "Cy");
  assert.equal(epitaph(lc.dead[0]), epitaph(lc.dead[0]), "epitaphs are deterministic");
});

test("rivalries count A-B-A edits within a month", () => {
  const f = "src/router.js";
  const commits = [
    commit("Ann", at(2020, 1, 1), "a", [["A", f, 10]]),
    commit("Ben", at(2020, 1, 3), "b", [["M", f, 1, 1]]),
    commit("Ann", at(2020, 1, 5), "a", [["M", f, 1, 1]]),
    commit("Ben", at(2020, 1, 7), "b", [["M", f, 1, 1]]),
    commit("Ann", at(2020, 6, 1), "late", [["M", f, 1, 1]]),
  ];
  const r = rivalries(commits, trackLifecycles(commits));
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].a, r[0].b, r[0].skirmishes], ["Ann", "Ben", 2]);
});

test("reverts are matched to the commit they undo", () => {
  const commits = [commit("Ann", at(2020, 1, 1), "Add cache"), commit("Ben", at(2020, 1, 3), 'Revert "Add cache"')];
  const [rv] = reverts(commits);
  assert.equal(rv.by, "Ben");
  assert.equal(rv.original?.by, "Ann");
});

test("hotspots favour busy, shared, buggy files and skip bookkeeping", () => {
  const commits = [
    commit("a", at(2020, 1), "add", [["A", "src/hot.js", 100], ["A", "src/cold.js", 100], ["A", "CHANGELOG.md", 10]]),
    ...["b", "c", "d"].map((who, i) => commit(who, at(2020, 2 + i), "fix bug", [["M", "src/hot.js", 5, 5], ["M", "CHANGELOG.md", 2]])),
    commit("a", at(2020, 6), "tweak", [["M", "src/cold.js", 1, 1]]),
  ];
  const hs = hotspots(commits, trackLifecycles(commits));
  assert.equal(hs[0].path, "src/hot.js");
  assert.equal(hs[0].fixes, 3);
  assert.ok(!hs.some((h) => h.path === "CHANGELOG.md"));
});

test("earthquakes rank by lines changed", () => {
  const commits = [commit("a", at(2020, 1), "small", [["A", "a.js", 5]]), commit("a", at(2020, 2), "big", [["A", "b.js", 500]])];
  assert.equal(earthquakes(commits)[0].subject, "big");
});

test("coupling finds files that change together across renames", () => {
  const commits = [
    commit("a", at(2020, 1), "1", [["A", "api/user.js", 10], ["A", "ui/user-form.js", 10]]),
    commit("a", at(2020, 2), "2", [["M", "api/user.js", 1], ["M", "ui/user-form.js", 1]]),
    commit("a", at(2020, 3), "3", [["R", "api/users.js", 1, 0, "api/user.js"], ["M", "ui/user-form.js", 1]]),
    commit("a", at(2020, 4), "4", [["M", "api/users.js", 1], ["M", "ui/user-form.js", 1]]),
    commit("a", at(2020, 5), "5", [["M", "api/users.js", 1]]),
  ];
  const [c] = buildCouplings(commits, trackLifecycles(commits));
  assert.equal(c.a, "api/users.js");
  assert.equal(c.b, "ui/user-form.js");
  assert.equal(c.together, 4);
  assert.ok(c.crossDir);
});

test("rhythm counts local time, lazy messages and silences", () => {
  const commits = [
    commit("a", at(2020, 1, 4, 2), "wip"), // Saturday 02:00
    commit("a", at(2020, 1, 6, 14), "Add parser"),
    commit("a", at(2020, 3, 1, 14), "wip"),
  ];
  const r = buildRhythm(commits);
  assert.equal(r.heatmap[6][2], 1);
  assert.equal(r.lazyMessages[0].subject, "wip");
  assert.equal(r.lazyMessages[0].count, 2);
  assert.ok(r.nightShare > 0.3);
  assert.equal(r.longestSilence?.days, 55);
});

test("milestones include genesis, arrivals, ordinals and the present", () => {
  const commits = Array.from({ length: 120 }, (_, i) => commit(i < 5 ? "Ann" : "Ben", at(2020, 1, 1) + i * 86400, `c${i}`, [["A", `f${i}.js`, 1]]));
  const ms = buildMilestones(commits, [], trackLifecycles(commits), false);
  const kinds = ms.map((m) => m.kind);
  assert.equal(kinds[0], "genesis");
  assert.ok(kinds.includes("arrival"));
  assert.ok(ms.some((m) => m.title === "Commit #100"));
  assert.equal(kinds.at(-1), "present");
});

test("notableTags keeps majors when there are too many tags", () => {
  const tags = Array.from({ length: 40 }, (_, i) => ({ name: `v${Math.floor(i / 10)}.${i % 10}.0`, time: i, hash: String(i) }));
  const picked = notableTags(tags, 6).map((t) => t.name);
  assert.ok(picked.length <= 6);
  assert.ok(picked.includes("v1.0.0") && picked.includes("v3.0.0"));
});

test("contributors earn archetypes", () => {
  const night = (i: number) => commit("Owl", at(2020, 1, 1 + i, 3), "Add thing", [["A", `src/owl${i}.js`, 5]]);
  const commits = [
    commit("Founder", at(2019, 1), "Initial commit", [["A", "README.md", 1]]),
    ...Array.from({ length: 12 }, (_, i) => night(i)),
    commit("Ghost", at(2020, 3), "typo", [["M", "README.md", 1, 1]]),
  ];
  const { list } = buildContributors(commits, trackLifecycles(commits));
  const ids = (n: string) => list.find((c) => c.name === n)!.archetypes.map((a) => a.id);
  assert.ok(ids("Founder").includes("founder"));
  assert.ok(ids("Owl").includes("owl"));
  assert.ok(ids("Owl").includes("architect"));
  assert.ok(ids("Ghost").includes("ghost"));
});

test("frameWindows: monthly for normal histories, bucketed otherwise", () => {
  const year = [commit("a", at(2020, 1, 15), "x"), commit("a", at(2020, 12, 15), "y")];
  assert.equal(frameWindows(year).starts.length, 12);
  const week = [commit("a", at(2020, 1, 1), "x"), commit("a", at(2020, 1, 8), "y")];
  const w = frameWindows(week);
  assert.ok(w.starts.length >= 2);
  assert.equal(w.ends.at(-1), week[1].time + 1);
  const decades = [commit("a", at(1990, 1, 1), "x"), commit("a", at(2020, 1, 1), "y")];
  assert.equal(frameWindows(decades).starts.length, 160);
});

test("strata switch to months when all surviving code is from one year", async () => {
  const { strataLayers } = await import("../src/analysis/survivors.js");
  const young = strataLayers(new Map([[2026, 30]]), new Map([["2026-08", 20], ["2026-09", 10]]));
  assert.equal(young.strataUnit, "month");
  assert.deepEqual(young.strata.map((x) => x.label), ["Aug 2026", "Sep 2026"]);
  const old = strataLayers(new Map([[2024, 5], [2020, 9]]), new Map([["2020-01", 9], ["2024-02", 5]]));
  assert.equal(old.strataUnit, "year");
  assert.deepEqual(old.strata.map((x) => x.label), ["2020", "2024"]);
});
