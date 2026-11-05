import type { Commit, Tag } from "../types.js";
import type { Era, MonthPoint } from "./report.js";
import type { Lifecycle } from "./lifecycle.js";
import { classify, type Mood } from "../util/messages.js";
import { monthStart, monthsBetween, nextMonth } from "../util/time.js";
import { bump, top } from "../util/stats.js";
import { isNoise, topDir } from "../util/files.js";

/** Commits, churn, authors and moods for every month of the project's life. */
export function monthlySeries(commits: Commit[]): MonthPoint[] {
  if (commits.length === 0) return [];
  const months = monthsBetween(commits[0].time, commits[commits.length - 1].time);
  const index = new Map(months.map((m, i) => [m, i]));
  const points: MonthPoint[] = months.map((t) => ({ t, commits: 0, added: 0, deleted: 0, authors: 0, moods: {} }));
  const authors = months.map(() => new Set<string>());
  for (const c of commits) {
    const i = index.get(monthStart(c.time));
    if (i === undefined) continue;
    const p = points[i];
    p.commits++;
    authors[i].add(c.author);
    const mood = classify(c.subject);
    p.moods[mood] = (p.moods[mood] ?? 0) + 1;
    for (const f of c.files) {
      if (isNoise(f.path)) continue;
      if (f.added > 0) p.added += f.added;
      if (f.deleted > 0) p.deleted += f.deleted;
    }
  }
  points.forEach((p, i) => (p.authors = authors[i].size));
  return points;
}

interface Segment {
  from: number; // month index, inclusive
  to: number; // month index, inclusive
}

/**
 * Split the monthly series into eras. Long dormant stretches always become
 * boundaries; busy segments are then split at their commit median until we
 * reach a target count that grows with the size of the history.
 */
export function segmentEras(months: MonthPoint[], totalCommits: number): Segment[] {
  const n = months.length;
  if (n === 0) return [];
  const target = Math.max(1, Math.min(7, Math.floor(n / 4), Math.round(Math.log2(Math.max(1, totalCommits / 25)))));

  // 1. Dormancy boundaries: runs of >= 4 empty months.
  const segs: Segment[] = [];
  let start = 0;
  let i = 0;
  while (i < n) {
    if (months[i].commits === 0) {
      let j = i;
      while (j < n && months[j].commits === 0) j++;
      if (j - i >= 4 && i > start && j < n) {
        segs.push({ from: start, to: i - 1 });
        segs.push({ from: i, to: j - 1 });
        start = j;
      }
      i = j;
    } else i++;
  }
  segs.push({ from: start, to: n - 1 });

  const commitsIn = (s: Segment) => {
    let c = 0;
    for (let k = s.from; k <= s.to; k++) c += months[k].commits;
    return c;
  };

  // 2. Split the "heaviest" segment where weight blends commits and elapsed
  //    time equally, so eras neither cram the busy early years together nor
  //    let a quiet decade collapse into one era.
  const weight = (k: number) => 0.5 * (months[k].commits / Math.max(1, totalCommits)) + 0.5 / n;
  const weightIn = (s: Segment) => {
    let w = 0;
    for (let k = s.from; k <= s.to; k++) w += weight(k);
    return w;
  };
  const activeCount = () => segs.filter((s) => commitsIn(s) > 0).length;
  let guard = 0;
  while (activeCount() < target && guard++ < 50) {
    let best = -1;
    let bestWeight = 0;
    segs.forEach((s, k) => {
      const w = weightIn(s);
      if (s.to - s.from >= 3 && commitsIn(s) > 0 && w > bestWeight) {
        best = k;
        bestWeight = w;
      }
    });
    if (best === -1) break;
    const s = segs[best];
    let acc = 0;
    let cut = s.from;
    for (let k = s.from; k <= s.to; k++) {
      acc += weight(k);
      if (acc >= bestWeight / 2) {
        cut = k;
        break;
      }
    }
    cut = Math.min(Math.max(cut, s.from + 1), s.to - 1);
    segs.splice(best, 1, { from: s.from, to: cut }, { from: cut + 1, to: s.to });
  }

  // 3. Merge tiny neighbours if we overshot.
  while (segs.length > 9) {
    let smallest = 0;
    for (let k = 1; k < segs.length; k++) if (commitsIn(segs[k]) < commitsIn(segs[smallest])) smallest = k;
    const neighbour = smallest === 0 ? 1 : smallest - 1;
    const a = Math.min(smallest, neighbour);
    segs.splice(a, 2, { from: segs[a].from, to: segs[a + 1].to });
  }
  return segs;
}

const QUIET_NAMES = ["The Long Silence", "The Quiet Years", "The Dormancy", "The Hibernation"];
const GENERIC_NAMES = ["The Middle Ages", "The Industrial Age", "The Steady Years", "The Age of Maintenance", "The Long March", "The Modern Era"];

/** Give each era a name based on what actually happened during it. */
export function nameEra(
  e: Omit<Era, "name" | "highlights">,
  prev: Era | undefined,
  isFirst: boolean,
  isLast: boolean,
  used: Set<string>,
  truncated = false,
): string {
  const months = Math.max(1, (e.end - e.start) / (30.4 * 86400));
  const perMonth = e.commits / months;
  const share = (m: Mood) => e.moodShare[m] ?? 0;
  const candidates: string[] = [];
  if (isFirst) candidates.push(truncated ? "The Excavation Begins" : "The Founding");
  if (e.commits === 0 || perMonth < 0.5) candidates.push(...QUIET_NAMES);
  if (prev && (prev.commits === 0 || prev.commits / Math.max(1, (prev.end - prev.start) / (30.4 * 86400)) < 0.5) && e.commits > 0)
    candidates.push("The Renaissance");
  if (share("fix") + share("panic") >= 0.35) candidates.push("The Bug Wars", "The Firefighting Years");
  if (e.deleted > e.added * 0.9 && e.deleted > 500) candidates.push("The Great Purge");
  if (share("refactor") >= 0.15) candidates.push("The Great Refactor", "The Reformation");
  if (prev && e.authors >= Math.max(4, prev.authors * 2)) candidates.push("The Gold Rush");
  if (prev && e.departures.length > e.newcomers.length + 2 && e.departures.length >= 3) candidates.push("The Exodus");
  if (share("feature") >= 0.35) candidates.push("The Expansion", "The Age of Invention");
  if (share("docs") >= 0.2) candidates.push("The Enlightenment");
  if (share("chore") >= 0.35) candidates.push("The Age of Upkeep");
  if (e.tags.length >= 3) candidates.push("The Release Train");
  if (isLast) candidates.push("The Present Day");
  candidates.push(...GENERIC_NAMES);
  for (const c of candidates) {
    if (!used.has(c)) {
      used.add(c);
      return c;
    }
  }
  let k = 2;
  while (used.has(`${candidates[0]} ${roman(k)}`)) k++;
  const name = `${candidates[0]} ${roman(k)}`;
  used.add(name);
  return name;
}

function roman(n: number): string {
  const map: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

/** Build fully described eras from the series, commits and file lifecycles. */
export function buildEras(commits: Commit[], months: MonthPoint[], tags: Tag[], lifecycle: Lifecycle, truncated = false): Era[] {
  const segs = segmentEras(months, commits.length);
  const firstSeen = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  const totalBy = new Map<string, number>();
  for (const c of commits) {
    bump(totalBy, c.author);
    if (!firstSeen.has(c.author)) firstSeen.set(c.author, c.time);
    lastSeen.set(c.author, c.time);
  }
  const lastCommitTime = commits.length ? commits[commits.length - 1].time : 0;
  const eras: Era[] = [];
  const used = new Set<string>();
  segs.forEach((s, k) => {
    const start = months[s.from].t;
    const end = nextMonth(months[s.to].t) - 1;
    const inEra = commits.filter((c) => c.time >= start && c.time <= end);
    const authors = new Map<string, number>();
    const dirs = new Map<string, number>();
    const moods = new Map<Mood, number>();
    let added = 0;
    let deleted = 0;
    for (const c of inEra) {
      bump(authors, c.author);
      bump(moods, classify(c.subject));
      for (const f of c.files) {
        if (isNoise(f.path)) continue;
        bump(dirs, topDir(f.path));
        if (f.added > 0) added += f.added;
        if (f.deleted > 0) deleted += f.deleted;
      }
    }
    const moodShare: Partial<Record<Mood, number>> = {};
    for (const [m, v] of moods) moodShare[m] = inEra.length ? v / inEra.length : 0;
    // Only people who mattered get named: at least 3 commits overall, busiest first.
    const notable = (a: string) => (totalBy.get(a) ?? 0) >= 3;
    const newcomers = [...authors.entries()]
      .filter(([a]) => (firstSeen.get(a) ?? 0) >= start && notable(a))
      .sort((x, y) => y[1] - x[1])
      .map(([a]) => a);
    const departures =
      k === segs.length - 1
        ? []
        : [...authors.entries()]
            .filter(([a]) => (lastSeen.get(a) ?? 0) <= end && (lastSeen.get(a) ?? 0) < lastCommitTime && notable(a))
            .sort((x, y) => (totalBy.get(y[0]) ?? 0) - (totalBy.get(x[0]) ?? 0))
            .map(([a]) => a);
    const base = {
      id: k,
      start,
      end,
      commits: inEra.length,
      authors: authors.size,
      topAuthors: top(authors, 3).map(([name, commits]) => ({ name, commits })),
      newcomers: newcomers.slice(0, 12),
      departures: departures.slice(0, 12),
      added,
      deleted,
      filesBorn: lifecycle.all.filter((l) => !l.preexisting && l.born >= start && l.born <= end).length,
      filesDied: lifecycle.dead.filter((l) => l.died!.time >= start && l.died!.time <= end).length,
      moodShare,
      topDirs: top(dirs, 4).map(([d]) => d),
      tags: tags.filter((t) => t.time >= start && t.time <= end).map((t) => t.name),
    };
    const name = nameEra(base, eras[k - 1], k === 0, k === segs.length - 1 && segs.length > 1, used, truncated);
    eras.push({ ...base, name, highlights: [] });
  });
  return eras;
}
