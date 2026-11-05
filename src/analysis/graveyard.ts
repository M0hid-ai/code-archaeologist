import type { Commit } from "../types.js";
import type { FileLife, Lifecycle } from "./lifecycle.js";
import type { Graveyard, Tombstone } from "./report.js";
import { isNoise, isTest, isDoc, fileName } from "../util/files.js";
import { bump, pick, top } from "../util/stats.js";
import { dayKey, humanDuration } from "../util/time.js";

/** Why did this file die? Read the murder weapon (the commit message). */
export function causeOfDeath(subject: string, life: FileLife): string {
  const s = subject.toLowerCase();
  if (/\brevert/.test(s)) return "Reverted out of existence";
  if (/\b(migrat|port(ed)? to|convert|moved? to|switch(ed)? to|replace[sd]? (with|by))/.test(s)) return "Replaced by a successor";
  if (/\b(refactor|restructur|reorganiz|rewrit|overhaul|consolidat|merge[sd]? into)/.test(s)) return "Lost in a refactor";
  if (/\b(dead code|unused|obsolete|deprecat|legacy|old)\b/.test(s)) return "Died of old age";
  if (/\b(clean ?up|tidy|prune|purge|remove[sd]?|delete[sd]?|drop(ped)?)\b/.test(s)) return "Swept away in a cleanup";
  if (/\b(fix|bug)/.test(s)) return "Collateral damage of a bug fix";
  if (isTest(life.path)) return "A test that stopped testing";
  if (isDoc(life.path)) return "Documentation nobody read";
  if (life.touches.length <= 1) return "Stillborn: never edited after birth";
  return "Causes unknown";
}

const EPITAPHS = {
  short: [
    "Here lies {name}. Brief, but it compiled.",
    "{name}: born and buried within {life}. Gone too soon.",
    "It barely had time to get a code review. RIP {name}.",
  ],
  long: [
    "{name} served faithfully for {life} before {killer} laid it to rest.",
    "After {life} of service and {commits} commits, {name} sleeps.",
    "{name} watched {authors} contributors come and go. It outlived most of them, but not {killer}.",
  ],
  big: [
    "{lines} lines, all gone in a single commit. {name} was too big to live.",
    "Once a giant of {peak} lines. Now just a memory in the reflog.",
  ],
  tiny: [
    "{name}: {lines} lines. Small file, big dreams.",
    "Few will remember {name}. Git will.",
  ],
  zombie: ["{name} died once and refused to stay buried."],
};

/** Deterministic, slightly irreverent epitaph for a tombstone. */
export function epitaph(life: FileLife): string {
  const d = life.died!;
  const lifespan = d.time - life.born;
  const vars: Record<string, string> = {
    name: fileName(life.path),
    life: humanDuration(lifespan),
    killer: d.by,
    commits: String(life.touches.length),
    authors: String(life.authors.size),
    lines: String(d.linesAtDeath),
    peak: String(life.peakLines),
  };
  let pool = EPITAPHS.long;
  if (life.resurrectionOf !== undefined) pool = EPITAPHS.zombie;
  else if (life.peakLines >= 1000) pool = EPITAPHS.big;
  else if (lifespan < 14 * 86400) pool = EPITAPHS.short;
  else if (life.peakLines > 0 && life.peakLines < 25) pool = EPITAPHS.tiny;
  return pick(pool, life.path + d.hash).replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? k);
}

export function buildGraveyard(commits: Commit[], lifecycle: Lifecycle, limit = 400): Graveyard {
  const dead = lifecycle.dead.filter((l) => !isNoise(l.path));
  const byId = new Map(lifecycle.all.map((l) => [l.id, l]));

  // Last commit message before the fatal one: the file's last words.
  const lastWords = (l: FileLife) => {
    const before = l.touches.length >= 2 ? commits[l.touches[l.touches.length - 2]] : undefined;
    return before ? before.subject : l.bornSubject;
  };

  const resurrected = new Set<number>();
  const zombies: Graveyard["zombies"] = [];
  for (const l of lifecycle.all) {
    if (l.resurrectionOf === undefined) continue;
    const ghost = byId.get(l.resurrectionOf);
    if (!ghost?.died || isNoise(l.path)) continue;
    resurrected.add(ghost.id);
    zombies.push({ path: l.path, diedAt: ghost.died.time, returnedAt: l.born, returnedBy: l.bornBy });
  }

  const tombstones: Tombstone[] = dead
    .map((l) => ({
      path: l.path,
      formerNames: l.formerNames,
      born: l.born,
      died: l.died!.time,
      bornBy: l.bornBy,
      killedBy: l.died!.by,
      lines: l.died!.linesAtDeath,
      peakLines: l.peakLines,
      commits: l.touches.length,
      authors: l.authors.size,
      cause: causeOfDeath(l.died!.subject, l),
      epitaph: epitaph(l),
      lastWords: lastWords(l),
      zombie: resurrected.has(l.id),
    }))
    // Most notable first: big, long-lived, much-edited files.
    .sort((a, b) => b.peakLines * Math.log2(2 + b.commits) - a.peakLines * Math.log2(2 + a.commits));

  const causes = new Map<string, number>();
  const reapers = new Map<string, number>();
  const perDay = new Map<string, { deaths: number; by: string; subject: string }>();
  let linesBuried = 0;
  for (const t of tombstones) {
    bump(causes, t.cause);
    bump(reapers, t.killedBy);
    linesBuried += t.lines;
  }
  for (const l of dead) {
    const key = dayKey(l.died!.time);
    const entry = perDay.get(key) ?? { deaths: 0, by: l.died!.by, subject: l.died!.subject };
    entry.deaths++;
    perDay.set(key, entry);
  }

  return {
    total: tombstones.length,
    linesBuried,
    tombstones: tombstones.slice(0, limit),
    zombies: zombies.sort((a, b) => a.returnedAt - b.returnedAt).slice(0, 50),
    massacres: [...perDay.entries()]
      .filter(([, v]) => v.deaths >= 3)
      .sort((a, b) => b[1].deaths - a[1].deaths)
      .slice(0, 8)
      .map(([day, v]) => ({ day, ...v })),
    causes: top(causes, 20).map(([cause, count]) => ({ cause, count })),
    reapers: top(reapers, 10).map(([name, kills]) => ({ name, kills })),
  };
}
