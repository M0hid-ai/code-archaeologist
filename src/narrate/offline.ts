import type { Era, Narrative, Report } from "../analysis/report.js";
import { pick } from "../util/stats.js";
import { humanDuration, isoDate } from "../util/time.js";

const fmt = (n: number) => n.toLocaleString("en");
const pct = (x: number) => `${Math.round(x * 100)}%`;

function list(names: string[], max = 3): string {
  const xs = names.slice(0, max);
  const rest = names.length - xs.length;
  if (rest > 0) return `${xs.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function month(t: number): string {
  return new Date(t * 1000).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Template narration for one era: no model required, never the same twice per repo. */
export function eraStory(e: Era, r: Report): string {
  const span = humanDuration(e.end - e.start);
  const seed = r.overview.name + e.id;
  const parts: string[] = [];
  if (e.commits === 0) {
    parts.push(
      pick(
        [
          `For ${span}, nothing. Not a commit, not a typo fix. The repository slept.`,
          `${span} of silence. Whatever the maintainers were doing, it was not this.`,
          `The dig site goes quiet for ${span}. The sediment here is perfectly undisturbed.`,
        ],
        seed,
      ),
    );
    return parts.join(" ");
  }
  const lead = e.topAuthors[0];
  parts.push(
    pick(
      [
        `From ${month(e.start)} to ${month(e.end)}, ${e.authors} ${e.authors === 1 ? "person" : "people"} made ${fmt(e.commits)} commits.`,
        `Over ${span} starting ${month(e.start)}, the project saw ${fmt(e.commits)} commits from ${e.authors} ${e.authors === 1 ? "contributor" : "contributors"}.`,
        `This era spans ${span} and ${fmt(e.commits)} commits.`,
      ],
      seed + "lead",
    ),
  );
  if (lead) {
    const share = lead.commits / e.commits;
    parts.push(
      share > 0.6
        ? `${lead.name} carried it almost single-handedly (${pct(share)} of all commits).`
        : `${lead.name} led the way with ${fmt(lead.commits)} commits${e.topAuthors.length > 1 ? `, followed by ${list(e.topAuthors.slice(1).map((a) => a.name))}` : ""}.`,
    );
  }
  if (e.newcomers.length && e.id > 0) parts.push(`New faces arrived: ${list(e.newcomers)}.`);
  if (e.departures.length) parts.push(`It was the last era for ${list(e.departures)}.`);
  const fixes = (e.moodShare.fix ?? 0) + (e.moodShare.panic ?? 0);
  if (fixes >= 0.3) parts.push(`Bug fixes made up ${pct(fixes)} of the work. Something was on fire.`);
  if ((e.moodShare.refactor ?? 0) >= 0.12) parts.push(`A lot of energy went into reshaping existing code rather than writing new code.`);
  if (e.added || e.deleted) {
    const net = e.added - e.deleted;
    parts.push(
      net >= 0
        ? `The codebase grew by ${fmt(net)} lines net (${fmt(e.added)} written, ${fmt(e.deleted)} erased).`
        : `The codebase actually shrank by ${fmt(-net)} lines: ${fmt(e.deleted)} erased against ${fmt(e.added)} written.`,
    );
  }
  if (e.filesBorn || e.filesDied) parts.push(`${fmt(e.filesBorn)} files were born and ${fmt(e.filesDied)} were buried.`);
  if (e.topDirs.length) parts.push(`Most digging happened in ${list(e.topDirs.slice(0, 3).map((d) => (d === "(root)" ? "the project root" : `${d}/`)))}.`);
  if (e.tags.length) parts.push(`Releases shipped: ${list(e.tags, 4)}.`);
  return parts.join(" ");
}

export function offlineNarrative(r: Report): Narrative {
  const o = r.overview;
  const age = humanDuration(o.lastCommit - o.firstCommit);
  const founder = r.contributors.find((c) => c.archetypes.some((a) => a.id === "founder"));
  const prologue = [
    o.truncated
      ? `This exhibit covers the most recent ${fmt(o.commits)} commits of ${o.name}, from ${isoDate(o.firstCommit)} to ${isoDate(o.lastCommit)}.`
      : `${o.name} began on ${isoDate(o.firstCommit)}${founder ? `, when ${founder.name} made the first commit` : ""}. That was ${age} and ${fmt(o.commits)} commits ago.`,
    `Along the way ${fmt(o.contributors)} ${o.contributors === 1 ? "person" : "people"} wrote ${fmt(o.linesAdded)} lines and deleted ${fmt(o.linesDeleted)}. Of everything ever written, ${fmt(o.linesAlive)} lines survive today across ${fmt(o.filesAlive)} files.`,
    o.filesDead ? `${fmt(o.filesDead)} files did not make it. They rest in the Graveyard.` : `Remarkably, no file has ever been deleted.`,
  ].join(" ");

  const eras = r.eras.map((e) => ({ id: e.id, title: e.name, story: eraStory(e, r) }));

  const g = r.graveyard;
  const b = r.battlefield;
  const s = r.survivors;
  const topHot = b.hotspots[0];
  const topRival = b.rivalries[0];
  const oldestFn = [...s.functions].sort((a, b2) => a.born - b2.born)[0];
  const toughest = s.functions[0];
  const placards: Record<string, string> = {
    timeline: `Every bar is a month of work. Coloured bands mark the ${r.eras.length} eras this project lived through; plaques mark the moments that mattered.`,
    timelapse: `Watch ${o.name} grow from its first file to ${fmt(o.filesAlive)}. Each tile is a file, sized by its line count and grouped by top-level directory. Outlined tiles are newborn; tiles that shrink away have died. Press play, and turn the sound on.`,
    survivors: toughest
      ? `${toughest.name}() in ${toughest.path} was written by ${toughest.bornBy} on ${isoDate(toughest.born)} and has survived ${fmt(toughest.commitsSurvived)} commits to its file, ${fmt(toughest.refactorsSurvived)} of them refactors.${oldestFn && oldestFn !== toughest ? ` The oldest living definition is ${oldestFn.name}(), dating from ${isoDate(oldestFn.born)}.` : ""}`
      : `The oldest living files of ${o.name}, and the code that has stayed put the longest.`,
    strata: `Like rock layers, each band shows how many surviving lines were written in that year (from ${fmt(s.sampledFiles)} excavated files).`,
    battlefield: topHot
      ? `${topHot.path} is the most contested ground: ${fmt(topHot.commits)} commits by ${fmt(topHot.authors)} people${topHot.fixes ? `, ${fmt(topHot.fixes)} of them bug fixes` : ""}.${topRival ? ` The fiercest tug-of-war: ${topRival.a} vs ${topRival.b} over ${topRival.path} (${topRival.skirmishes} skirmishes).` : ""}`
      : `No real battles here. A peaceful codebase.`,
    graveyard: g.total
      ? `${fmt(g.total)} files lie buried here, taking ${fmt(g.linesBuried)} lines with them.${g.reapers[0] ? ` The most prolific reaper: ${g.reapers[0].name}, with ${fmt(g.reapers[0].kills)} deletions.` : ""}${g.zombies.length ? ` ${fmt(g.zombies.length)} of the dead rose again.` : ""}`
      : `The graveyard is empty. Nothing has ever been deleted.`,
    gallery: `${fmt(o.contributors)} people shaped ${o.name}. Each portrait shows when they were active and what kind of contributor they were.`,
    constellations: r.couplings.length
      ? `Files that keep changing together, whether or not they live near each other. ${r.couplings.filter((c) => c.crossDir).length} of these pairs cross directory boundaries: hidden dependencies.`
      : `No strong change coupling was found.`,
    rhythm: `${pct(r.rhythm.nightShare)} of commits happened between midnight and 5am (in the author's own timezone) and ${pct(r.rhythm.weekendShare)} on weekends.${r.rhythm.busiestDay ? ` The busiest day ever was ${r.rhythm.busiestDay.day}, with ${fmt(r.rhythm.busiestDay.commits)} commits.` : ""}`,
    archive: `The raw record: the ${fmt(r.archive.length)} most recent commits. Search by message, author or hash.`,
  };

  const last = r.eras[r.eras.length - 1];
  const epilogue = [
    `Today ${o.name} stands at ${fmt(o.linesAlive)} lines.`,
    last && last.commits ? `In its latest era, "${last.name}", ${list(last.topAuthors.map((a) => a.name))} ${last.topAuthors.length === 1 ? "keeps" : "keep"} it moving.` : "",
    `The dig continues with every commit.`,
  ]
    .filter(Boolean)
    .join(" ");

  return { source: "offline", prologue, eras, epilogue, placards };
}
