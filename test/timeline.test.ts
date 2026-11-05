import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlySeries, nameEra, segmentEras } from "../src/analysis/timeline.js";
import type { MonthPoint } from "../src/analysis/report.js";
import { at, commit } from "./helpers.js";

const months = (counts: number[]): MonthPoint[] =>
  counts.map((c, i) => ({ t: at(2020, 1 + i), commits: c, added: 0, deleted: 0, authors: c ? 1 : 0, moods: {} }));

test("monthlySeries fills empty months and counts moods", () => {
  const series = monthlySeries([
    commit("a", at(2021, 1, 5), "Add parser", [["A", "src/p.ts", 10, 0]]),
    commit("b", at(2021, 1, 9), "fix: crash", [["M", "src/p.ts", 2, 1]]),
    commit("a", at(2021, 4, 2), "docs", [["M", "package-lock.json", 500, 400]]),
  ]);
  assert.equal(series.length, 4);
  assert.equal(series[0].commits, 2);
  assert.equal(series[0].authors, 2);
  assert.equal(series[0].added, 12);
  assert.equal(series[0].moods.feature, 1);
  assert.equal(series[0].moods.fix, 1);
  assert.equal(series[1].commits, 0);
  assert.equal(series[3].added, 0, "lockfile churn is noise");
});

test("segmentEras splits on long dormancy", () => {
  const segs = segmentEras(months([5, 6, 4, 0, 0, 0, 0, 0, 7, 8, 9, 6]), 45);
  const dormant = segs.find((s) => s.from === 3);
  assert.ok(dormant, "the silent stretch becomes its own era");
  assert.equal(dormant.to, 7);
});

test("segmentEras covers every month exactly once", () => {
  const counts = Array.from({ length: 60 }, (_, i) => (i < 12 ? 50 : 5));
  const segs = segmentEras(months(counts), counts.reduce((a, b) => a + b, 0));
  assert.ok(segs.length >= 3 && segs.length <= 9);
  assert.equal(segs[0].from, 0);
  assert.equal(segs.at(-1)!.to, 59);
  for (let i = 1; i < segs.length; i++) assert.equal(segs[i].from, segs[i - 1].to + 1);
});

test("segmentEras keeps tiny histories in one era", () => {
  assert.equal(segmentEras(months([3, 2]), 5).length, 1);
  assert.deepEqual(segmentEras([], 0), []);
});

test("nameEra reads the room", () => {
  const base = {
    id: 1, start: at(2020, 1), end: at(2020, 12), commits: 100, authors: 3, topAuthors: [], newcomers: [], departures: [],
    added: 1000, deleted: 100, filesBorn: 0, filesDied: 0, moodShare: {}, topDirs: [], tags: [],
  };
  const used = () => new Set<string>();
  assert.equal(nameEra(base, undefined, true, false, used()), "The Founding");
  assert.equal(nameEra({ ...base, moodShare: { fix: 0.3, panic: 0.1 } }, undefined, false, false, used()), "The Bug Wars");
  assert.equal(nameEra({ ...base, commits: 2 }, undefined, false, false, used()), "The Long Silence");
  assert.equal(nameEra({ ...base, deleted: 5000, added: 1000 }, undefined, false, false, used()), "The Great Purge");
  const taken = new Set(["The Bug Wars"]);
  assert.equal(nameEra({ ...base, moodShare: { fix: 0.5 } }, undefined, false, false, taken), "The Firefighting Years");
});

test("eraHighlights names the biggest commit and busiest day", async () => {
  const { eraHighlights } = await import("../src/analysis/timeline.js");
  const day = at(2021, 5, 4);
  const commits = [
    commit("a", day - 86400 * 30, "Start the thing", [["A", "a.js", 3]]),
    ...Array.from({ length: 5 }, (_, i) => commit("b", day + i * 60, `tweak ${i}`, [["M", "a.js", 1, 1]])),
    commit("c", day + 86400, "Import the world", [["A", "w.js", 900]]),
  ];
  const hl = eraHighlights(commits);
  assert.ok(hl[0].includes("Import the world") && hl[0].includes("900"));
  assert.ok(hl.some((x) => x.includes("2021-05-04") && x.includes("5 commits")));
  assert.ok(hl.some((x) => x.includes("Start the thing")));
});
