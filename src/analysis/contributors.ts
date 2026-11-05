import type { Commit } from "../types.js";
import type { Lifecycle } from "./lifecycle.js";
import type { Contributor } from "./report.js";
import { isBot } from "./identity.js";
import { isDoc, isNoise, isTest, topDir } from "../util/files.js";
import { classify, type Mood } from "../util/messages.js";
import { bump, downsample, top } from "../util/stats.js";
import { dayKey, monthStart, monthsBetween, DAY } from "../util/time.js";

interface Acc {
  name: string;
  commits: number;
  added: number;
  deleted: number;
  filesCreated: number;
  filesDeleted: number;
  first: number;
  last: number;
  days: Set<string>;
  dirs: Map<string, number>;
  moods: Map<Mood, number>;
  night: number;
  early: number;
  weekend: number;
  testFiles: number;
  docFiles: number;
  touchedFiles: number;
  monthly: Map<number, number>;
}

type Archetype = Contributor["archetypes"][number];

/** Character badges derived from how someone actually committed. */
export function archetypes(a: Acc, ctx: { founder: string; topCommitter: string; projectSpan: number }): Archetype[] {
  const out: Archetype[] = [];
  const n = a.commits;
  const share = (x: number) => (n ? x / n : 0);
  const fixes = (a.moods.get("fix") ?? 0) + (a.moods.get("panic") ?? 0);
  const span = a.last - a.first;

  if (isBot(a.name)) out.push({ id: "bot", title: "The Automaton", reason: "Tireless, sleepless, and probably bumping dependencies." });
  if (a.name === ctx.founder) out.push({ id: "founder", title: "The Founder", reason: "Wrote the very first commit." });
  if (a.name === ctx.topCommitter && n > 1) out.push({ id: "titan", title: "The Titan", reason: "More commits than anyone else." });
  if (a.filesCreated >= 10 && a.filesCreated / Math.max(1, n) >= 0.5)
    out.push({ id: "architect", title: "The Architect", reason: `Created ${a.filesCreated} files.` });
  if ((a.deleted > a.added && a.deleted >= 500) || a.filesDeleted >= 20)
    out.push({ id: "janitor", title: "The Janitor", reason: `Deleted ${a.deleted.toLocaleString("en")} lines and ${a.filesDeleted} files.` });
  if (n >= 8 && share(fixes) >= 0.4) out.push({ id: "firefighter", title: "The Firefighter", reason: `${Math.round(share(fixes) * 100)}% of commits were fixes.` });
  if (n >= 8 && share(a.night) >= 0.25) out.push({ id: "owl", title: "The Night Owl", reason: `${Math.round(share(a.night) * 100)}% of commits between midnight and 5am.` });
  if (n >= 8 && share(a.early) >= 0.3) out.push({ id: "lark", title: "The Early Bird", reason: `${Math.round(share(a.early) * 100)}% of commits before 9am.` });
  if (n >= 8 && share(a.weekend) >= 0.4) out.push({ id: "weekend", title: "The Weekend Warrior", reason: `${Math.round(share(a.weekend) * 100)}% of commits on weekends.` });
  if (n >= 5 && a.touchedFiles && a.testFiles / a.touchedFiles >= 0.5) out.push({ id: "tester", title: "The Inspector", reason: "Mostly touches tests." });
  if (n >= 5 && a.touchedFiles && a.docFiles / a.touchedFiles >= 0.5) out.push({ id: "scribe", title: "The Scribe", reason: "Mostly writes documentation." });
  if (n >= 5 && share(a.moods.get("refactor") ?? 0) >= 0.25) out.push({ id: "sculptor", title: "The Sculptor", reason: "Constantly reshaping existing code." });
  if (span >= 3 * 365 * DAY) out.push({ id: "marathoner", title: "The Marathoner", reason: `Active across ${Math.round(span / (365 * DAY))} years.` });
  if (n >= 20 && span <= 45 * DAY) out.push({ id: "comet", title: "The Comet", reason: `${n} commits in a ${Math.max(1, Math.round(span / DAY))}-day blaze, then gone.` });
  if (n === 1) out.push({ id: "ghost", title: "The Ghost", reason: "One commit, then vanished into the mist." });
  if (out.length === 0) out.push({ id: "citizen", title: "The Steady Hand", reason: "Quietly kept things moving." });
  return out.slice(0, 4);
}

export function buildContributors(commits: Commit[], lifecycle: Lifecycle, limit = 60): { list: Contributor[]; others: number } {
  const accs = new Map<string, Acc>();
  const get = (name: string, t: number): Acc => {
    let a = accs.get(name);
    if (!a) {
      a = {
        name, commits: 0, added: 0, deleted: 0, filesCreated: 0, filesDeleted: 0, first: t, last: t,
        days: new Set(), dirs: new Map(), moods: new Map(), night: 0, early: 0, weekend: 0,
        testFiles: 0, docFiles: 0, touchedFiles: 0, monthly: new Map(),
      };
      accs.set(name, a);
    }
    return a;
  };

  for (const c of commits) {
    const a = get(c.author, c.time);
    a.commits++;
    a.last = c.time;
    a.days.add(dayKey(c.time));
    bump(a.moods, classify(c.subject));
    bump(a.monthly, monthStart(c.time));
    if (c.localHour < 5) a.night++;
    else if (c.localHour < 9) a.early++;
    if (c.localWeekday === 0 || c.localWeekday === 6) a.weekend++;
    for (const f of c.files) {
      if (isNoise(f.path)) continue;
      a.touchedFiles++;
      if (isTest(f.path)) a.testFiles++;
      else if (isDoc(f.path)) a.docFiles++;
      bump(a.dirs, topDir(f.path));
      if (f.added > 0) a.added += f.added;
      if (f.deleted > 0) a.deleted += f.deleted;
    }
  }
  for (const l of lifecycle.all) {
    if (isNoise(l.path)) continue;
    if (!l.preexisting && accs.has(l.bornBy)) accs.get(l.bornBy)!.filesCreated++;
    if (l.died && accs.has(l.died.by)) accs.get(l.died.by)!.filesDeleted++;
  }

  const months = commits.length ? monthsBetween(commits[0].time, commits[commits.length - 1].time) : [];
  const sorted = [...accs.values()].sort((x, y) => y.commits - x.commits);
  const ctx = {
    founder: commits[0]?.author ?? "",
    topCommitter: sorted[0]?.name ?? "",
    projectSpan: commits.length ? commits[commits.length - 1].time - commits[0].time : 0,
  };

  const list: Contributor[] = sorted.slice(0, limit).map((a) => {
    const moods: Partial<Record<Mood, number>> = {};
    for (const [m, v] of a.moods) moods[m] = v;
    return {
      name: a.name,
      bot: isBot(a.name),
      commits: a.commits,
      added: a.added,
      deleted: a.deleted,
      filesCreated: a.filesCreated,
      filesDeleted: a.filesDeleted,
      first: a.first,
      last: a.last,
      activeDays: a.days.size,
      topDirs: top(a.dirs, 3).map(([d]) => d),
      moods,
      sparkline: downsample(months.map((m) => a.monthly.get(m) ?? 0), 48),
      archetypes: archetypes(a, ctx),
    };
  });
  return { list, others: Math.max(0, sorted.length - limit) };
}
