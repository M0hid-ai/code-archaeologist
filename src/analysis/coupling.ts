import type { Commit } from "../types.js";
import type { Lifecycle } from "./lifecycle.js";
import type { Coupling } from "./report.js";
import { isBookkeeping, isNoise, topDir } from "../util/files.js";

export interface CouplingOptions {
  /** Ignore commits touching more files than this (mass renames, formatting). */
  maxFilesPerCommit?: number;
  /** A file needs at least this many commits to be considered. */
  minCommits?: number;
  /** A pair needs at least this many shared commits. */
  minTogether?: number;
  limit?: number;
}

/**
 * Change coupling: files that keep changing in the same commits even
 * though nothing in the directory layout says they belong together.
 * Paths are resolved through renames via the lifecycle so that a file's
 * history is not split in two when it moves.
 */
export function buildCouplings(commits: Commit[], lifecycle: Lifecycle, opts: CouplingOptions = {}): Coupling[] {
  const maxFiles = opts.maxFilesPerCommit ?? 25;
  const minCommits = opts.minCommits ?? 4;
  const minTogether = opts.minTogether ?? 3;
  const limit = opts.limit ?? 40;

  // commit index -> life ids touched (via the lifecycle's touch lists)
  const perCommit = new Map<number, number[]>();
  const lifeCommits = new Map<number, number>();
  for (const l of lifecycle.all) {
    if (isNoise(l.path) || isBookkeeping(l.path) || l.touches.length < minCommits) continue;
    lifeCommits.set(l.id, l.touches.length);
    for (const i of l.touches) {
      let arr = perCommit.get(i);
      if (!arr) perCommit.set(i, (arr = []));
      arr.push(l.id);
    }
  }

  const pairs = new Map<number, number>();
  const N = lifecycle.all.length + 1;
  for (const [i, ids] of perCommit) {
    if (ids.length < 2 || commits[i].files.length > maxFiles) continue;
    ids.sort((a, b) => a - b);
    for (let x = 0; x < ids.length; x++)
      for (let y = x + 1; y < ids.length; y++) {
        const key = ids[x] * N + ids[y];
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
  }

  const out: Coupling[] = [];
  for (const [key, together] of pairs) {
    if (together < minTogether) continue;
    const a = lifecycle.all[Math.floor(key / N)];
    const b = lifecycle.all[key % N];
    const confidence = together / Math.min(lifeCommits.get(a.id)!, lifeCommits.get(b.id)!);
    if (confidence < 0.3) continue;
    out.push({
      a: a.path,
      b: b.path,
      together,
      confidence: Math.round(confidence * 100) / 100,
      crossDir: topDir(a.path) !== topDir(b.path),
      alive: !a.died && !b.died,
    });
  }
  return out
    .sort((x, y) => y.together * y.confidence - x.together * x.confidence)
    .slice(0, limit);
}
