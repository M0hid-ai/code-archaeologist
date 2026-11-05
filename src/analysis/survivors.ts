import type { Commit } from "../types.js";
import type { FileLife, Lifecycle } from "./lifecycle.js";
import type { Fossil, SurvivorFunction, Survivors } from "./report.js";
import { blame, type BlameLine } from "../git/blame.js";
import { findFunctions, supportsFunctions } from "./functions.js";
import { isNoise, isCode } from "../util/files.js";
import { isRefactor } from "../util/messages.js";
import { hash32 } from "../util/stats.js";

export interface SurvivorOptions {
  repoDir: string;
  head: string;
  /** Maximum number of files to blame (blame is the slow part). */
  maxFiles?: number;
  /** Skip files longer than this many lines. */
  maxLines?: number;
  concurrency?: number;
  /** Map raw blame author names to canonical names. */
  canonical?: Map<string, string>;
  onProgress?: (done: number, total: number) => void;
}

/** Choose which living files to excavate with blame. */
export function sampleFiles(lifecycle: Lifecycle, maxFiles: number, maxLines: number): FileLife[] {
  const pool = lifecycle.alive.filter((l) => !isNoise(l.path) && !l.binary && isCode(l.path) && l.lines > 0 && l.lines <= maxLines);
  if (pool.length <= maxFiles) return pool;
  const chosen = new Map<number, FileLife>();
  const add = (xs: FileLife[], n: number) => {
    for (const l of xs) {
      if (n <= 0 || chosen.size >= maxFiles) break;
      if (!chosen.has(l.id)) {
        chosen.set(l.id, l);
        n--;
      }
    }
  };
  const third = Math.ceil(maxFiles / 3);
  add([...pool].sort((a, b) => a.born - b.born), third); // the elders
  add([...pool].sort((a, b) => b.touches.length - a.touches.length), third); // the battle-scarred
  add([...pool].sort((a, b) => hash32(a.path) - hash32(b.path)), maxFiles); // a fair random sample
  return [...chosen.values()];
}

/** Did this commit reshape the file substantially or call itself a refactor? */
function refactoredIn(c: Commit, names: Set<string>, sizeHint: number): boolean {
  if (isRefactor(c.subject)) return true;
  for (const f of c.files) {
    if (!names.has(f.path)) continue;
    if (f.status === "R") return true;
    const churn = Math.max(0, f.added) + Math.max(0, f.deleted);
    if (churn >= Math.max(30, sizeHint * 0.4)) return true;
  }
  return false;
}

export function functionSurvivors(life: FileLife, lines: BlameLine[], commits: Commit[], canonical?: Map<string, string>): SurvivorFunction[] {
  const defs = findFunctions(life.path, lines.map((l) => l.content));
  const names = new Set([life.path, ...life.formerNames]);
  const out: SurvivorFunction[] = [];
  defs.forEach((d, k) => {
    const sig = lines[d.line];
    if (!sig || !sig.time) return;
    const end = Math.min(k + 1 < defs.length ? defs[k + 1].line : lines.length, d.line + 400);
    const authors = new Set<string>();
    for (let i = d.line; i < end; i++) authors.add(canonical?.get(lines[i].author) ?? lines[i].author);
    let survived = 0;
    let refactors = 0;
    for (const idx of life.touches) {
      const c = commits[idx];
      if (c.time <= sig.time || c.hash === sig.hash) continue;
      survived++;
      if (refactoredIn(c, names, life.lines)) refactors++;
    }
    out.push({
      name: d.name,
      path: life.path,
      line: d.line + 1,
      born: sig.time,
      bornBy: canonical?.get(sig.author) ?? sig.author,
      commitsSurvived: survived,
      refactorsSurvived: refactors,
      authorsTouched: authors.size,
      lines: end - d.line,
    });
  });
  return out;
}

const toFossil = (l: FileLife): Fossil => ({
  path: l.path,
  born: l.born,
  lastTouched: l.lastTime,
  bornBy: l.bornBy,
  commits: l.touches.length,
  lines: l.lines,
});

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Excavate the oldest living code: functions, files and sediment layers. */
export async function buildSurvivors(commits: Commit[], lifecycle: Lifecycle, opts: SurvivorOptions): Promise<Survivors> {
  const living = lifecycle.alive.filter((l) => !isNoise(l.path));
  const elders = living.filter((l) => !l.preexisting).sort((a, b) => a.born - b.born).slice(0, 15).map(toFossil);
  const fossils = living
    .filter((l) => l.touches.length > 0)
    .sort((a, b) => a.lastTime - b.lastTime)
    .slice(0, 15)
    .map(toFossil);

  const files = sampleFiles(lifecycle, opts.maxFiles ?? 150, opts.maxLines ?? 5000);
  const strata = new Map<number, number>();
  const fns: SurvivorFunction[] = [];
  let sampledLines = 0;
  let done = 0;
  await pool(files, opts.concurrency ?? 6, async (life) => {
    let lines: BlameLine[] = [];
    try {
      lines = await blame(opts.repoDir, life.path, opts.head);
    } catch {
      /* binary, submodule or vanished file: skip */
    }
    sampledLines += lines.length;
    for (const l of lines) {
      if (!l.time) continue;
      const year = new Date(l.time * 1000).getUTCFullYear();
      strata.set(year, (strata.get(year) ?? 0) + 1);
    }
    if (supportsFunctions(life.path)) fns.push(...functionSurvivors(life, lines, commits, opts.canonical));
    opts.onProgress?.(++done, files.length);
  });

  // Rank by battles survived, then age; at most three exhibits per file.
  fns.sort((a, b) => b.refactorsSurvived - a.refactorsSurvived || b.commitsSurvived - a.commitsSurvived || a.born - b.born);
  const perFile = new Map<string, number>();
  const functions: SurvivorFunction[] = [];
  for (const f of fns) {
    if (f.commitsSurvived === 0) continue;
    const n = perFile.get(f.path) ?? 0;
    if (n >= 3) continue;
    perFile.set(f.path, n + 1);
    functions.push(f);
    if (functions.length >= 40) break;
  }

  return {
    functions,
    elders,
    fossils,
    strata: [...strata.entries()].sort((a, b) => a[0] - b[0]).map(([year, lines]) => ({ year, lines })),
    sampledFiles: files.length,
    sampledLines,
  };
}
