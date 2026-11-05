import type { Commit } from "../types.js";
import type { Lifecycle } from "./lifecycle.js";
import type { Battlefield, Hotspot, Revert, Rivalry } from "./report.js";
import { isNoise } from "../util/files.js";
import { isFix, revertedSubject } from "../util/messages.js";

const RIVALRY_WINDOW = 30 * 86400;

/**
 * Hotspots are files that are big, edited often and by many hands, and
 * keep attracting bug fixes. Recency gives a mild boost so that the
 * current battlegrounds outrank ancient ones.
 */
export function hotspots(commits: Commit[], lifecycle: Lifecycle, limit = 30): Hotspot[] {
  const now = commits.length ? commits[commits.length - 1].time : 0;
  const span = Math.max(1, now - (commits[0]?.time ?? now));
  const list: Hotspot[] = [];
  for (const l of lifecycle.alive) {
    if (isNoise(l.path) || l.touches.length < 2) continue;
    const fixes = l.touches.filter((i) => isFix(commits[i].subject)).length;
    const churn = l.added + l.deleted;
    const recency = 0.5 + 0.5 * (1 - (now - l.lastTime) / span);
    const score =
      l.touches.length * Math.log2(1 + l.authors.size) * Math.log10(10 + l.lines) * (1 + fixes / l.touches.length) * recency;
    list.push({
      path: l.path,
      commits: l.touches.length,
      authors: l.authors.size,
      churn,
      lines: l.lines,
      fixes,
      score: Math.round(score * 10) / 10,
      lastTouched: l.lastTime,
    });
  }
  return list.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * A skirmish is A editing a file, then B, then A again, all within a month:
 * the classic tug-of-war over who gets the final word.
 */
export function rivalries(commits: Commit[], lifecycle: Lifecycle, limit = 20): Rivalry[] {
  const counts = new Map<string, Rivalry>();
  for (const l of lifecycle.all) {
    if (isNoise(l.path) || l.authors.size < 2 || l.touches.length < 3) continue;
    // Collapse consecutive edits by the same author.
    const seq: { a: string; t: number }[] = [];
    for (const i of l.touches) {
      const c = commits[i];
      if (seq.length && seq[seq.length - 1].a === c.author) seq[seq.length - 1].t = c.time;
      else seq.push({ a: c.author, t: c.time });
    }
    for (let k = 2; k < seq.length; k++) {
      const [x, y, z] = [seq[k - 2], seq[k - 1], seq[k]];
      if (x.a === z.a && z.t - x.t <= RIVALRY_WINDOW) {
        const [a, b] = [x.a, y.a].sort();
        const key = `${a}\u0000${b}\u0000${l.path}`;
        const r = counts.get(key) ?? { a, b, path: l.path, skirmishes: 0 };
        r.skirmishes++;
        counts.set(key, r);
      }
    }
  }
  return [...counts.values()]
    .filter((r) => r.skirmishes >= 2)
    .sort((x, y) => y.skirmishes - x.skirmishes)
    .slice(0, limit);
}

/** Every revert, matched with the commit it undid when we can find it. */
export function reverts(commits: Commit[], limit = 40): Revert[] {
  const bySubject = new Map<string, Commit>();
  const out: Revert[] = [];
  for (const c of commits) {
    const original = revertedSubject(c.subject);
    if (original !== null || /^revert\b/i.test(c.subject)) {
      const o = original !== null ? bySubject.get(original) : undefined;
      out.push({
        t: c.time,
        by: c.author,
        subject: c.subject,
        hash: c.hash,
        ...(o ? { original: { t: o.time, by: o.author } } : {}),
      });
    }
    bySubject.set(c.subject, c);
  }
  return out.slice(-limit).reverse();
}

/** The largest single commits by lines changed (excluding noise files). */
export function earthquakes(commits: Commit[], limit = 10): Battlefield["earthquakes"] {
  return commits
    .filter((c) => c.parents.length <= 1)
    .map((c) => {
      let churn = 0;
      let files = 0;
      for (const f of c.files) {
        if (isNoise(f.path)) continue;
        files++;
        churn += Math.max(0, f.added) + Math.max(0, f.deleted);
      }
      return { t: c.time, by: c.author, subject: c.subject, files, churn, hash: c.hash };
    })
    .sort((a, b) => b.churn - a.churn)
    .slice(0, limit);
}

export function buildBattlefield(commits: Commit[], lifecycle: Lifecycle): Battlefield {
  return {
    hotspots: hotspots(commits, lifecycle),
    rivalries: rivalries(commits, lifecycle),
    reverts: reverts(commits),
    earthquakes: earthquakes(commits),
  };
}
