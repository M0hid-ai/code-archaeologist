import type { Commit } from "../types.js";
import type { Lifecycle } from "./lifecycle.js";
import type { Timelapse, TimelapseFile } from "./report.js";
import { isNoise, language, topDir } from "../util/files.js";
import { monthStart, monthsBetween, nextMonth } from "../util/time.js";
import { bump, top } from "../util/stats.js";

export const MAX_FRAMES = 160;

/**
 * Frame boundaries for the timelapse. Frame k covers [starts[k], ends[k])
 * and shows the codebase as it stood at the end of that period.
 */
export function frameWindows(commits: Commit[], maxFrames = MAX_FRAMES): { starts: number[]; ends: number[] } {
  if (commits.length === 0) return { starts: [], ends: [] };
  const first = commits[0].time;
  const last = commits[commits.length - 1].time;
  const months = monthsBetween(first, last);
  if (months.length >= 6 && months.length <= maxFrames) {
    return { starts: months, ends: months.map((m) => nextMonth(m)) };
  }
  // Very young projects get weekly-ish frames; very old ones get coarser buckets.
  const from = months.length < 6 ? first : monthStart(first);
  const to = last + 1;
  const n = months.length < 6 ? Math.min(maxFrames, Math.max(2, Math.min(commits.length, 24))) : maxFrames;
  const step = (to - from) / n;
  const starts = Array.from({ length: n }, (_, k) => Math.floor(from + k * step));
  const ends = starts.map((s, k) => (k === n - 1 ? to : starts[k + 1]));
  return { starts, ends };
}

/**
 * Convert raw lifecycle snapshots into compact timelapse frames. The
 * largest files keep their own tile; everything else is pooled into one
 * "other files" tile per top-level directory so the page stays small.
 */
export function buildTimelapse(commits: Commit[], lifecycle: Lifecycle, starts: number[], maxFiles = 600): Timelapse {
  const candidates = lifecycle.all
    .filter((l) => !isNoise(l.path) && l.peakLines > 0)
    .sort((a, b) => b.peakLines - a.peakLines);
  const featured = candidates.slice(0, maxFiles);
  const files: TimelapseFile[] = [];
  const fileIndex = new Map<number, number>();
  for (const l of featured) {
    fileIndex.set(l.id, files.length);
    files.push({ path: l.path, dir: topDir(l.path), lang: language(l.path) });
  }
  const pooled = new Map<string, number>();
  for (const l of candidates.slice(maxFiles)) {
    const dir = topDir(l.path);
    if (!pooled.has(dir)) {
      pooled.set(dir, files.length);
      files.push({ path: `${dir === "(root)" ? "" : dir + "/"}…other files`, dir, lang: "Other" });
    }
    fileIndex.set(l.id, pooled.get(dir)!);
  }

  const frames: Timelapse["frames"] = [];
  let ci = 0;
  const bornAt = new Map<number, number>();
  const diedAt = new Map<number, number>();
  const frameOf = (t: number) => {
    // index of the frame whose window contains t
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  for (const l of lifecycle.all) {
    if (isNoise(l.path)) continue;
    if (!l.preexisting) bump(bornAt, frameOf(l.born));
    if (l.died) bump(diedAt, frameOf(l.died.time));
  }

  lifecycle.frames.forEach((snap, k) => {
    const sizes = new Map<number, number>();
    let totalLines = 0;
    let totalFiles = 0;
    for (let i = 0; i < snap.length; i += 2) {
      const id = snap[i];
      const lines = snap[i + 1];
      const life = lifecycle.all[id];
      if (isNoise(life.path)) continue;
      totalFiles++;
      totalLines += lines;
      const idx = fileIndex.get(id);
      if (idx !== undefined && lines > 0) sizes.set(idx, (sizes.get(idx) ?? 0) + lines);
    }
    const authors = new Map<string, number>();
    let count = 0;
    const end = k + 1 < starts.length ? starts[k + 1] : Infinity;
    while (ci < commits.length && commits[ci].time < end) {
      if (commits[ci].time >= starts[k]) {
        count++;
        bump(authors, commits[ci].author);
      }
      ci++;
    }
    const flat: number[] = [];
    for (const [idx, lines] of [...sizes.entries()].sort((a, b) => a[0] - b[0])) flat.push(idx, lines);
    frames.push({
      t: starts[k],
      sizes: flat,
      commits: count,
      authors: top(authors, 3).map(([a]) => a),
      born: bornAt.get(k) ?? 0,
      died: diedAt.get(k) ?? 0,
      totalLines,
      totalFiles,
    });
  });
  return { files, frames };
}
