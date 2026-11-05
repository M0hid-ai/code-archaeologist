import type { RepoHistory } from "../types.js";
import type { ArchiveEntry, Overview, Report } from "./report.js";
import { buildBattlefield } from "./battlefield.js";
import { buildContributors } from "./contributors.js";
import { buildCouplings } from "./coupling.js";
import { buildGraveyard } from "./graveyard.js";
import { canonicalAuthors } from "./identity.js";
import { seedLines, trackLifecycles } from "./lifecycle.js";
import { countLines } from "../git/lines.js";
import { buildMilestones } from "./milestones.js";
import { buildRhythm } from "./rhythm.js";
import { buildSurvivors } from "./survivors.js";
import { buildTimelapse, frameWindows } from "./timelapse.js";
import { buildEras, monthlySeries } from "./timeline.js";
import { isNoise, language } from "../util/files.js";
import { classify } from "../util/messages.js";
import { offlineNarrative } from "../narrate/offline.js";
import { VERSION } from "../version.js";

export interface AnalyzeOptions {
  repoDir: string;
  truncated?: boolean;
  blameFiles?: number;
  archiveLimit?: number;
  log?: (msg: string) => void;
}

function overview(
  h: RepoHistory,
  lc: ReturnType<typeof trackLifecycles>,
  contributors: number,
  truncated: boolean,
  headLines?: Map<string, number>,
): Overview {
  const commits = h.commits;
  let added = 0;
  let deleted = 0;
  let merges = 0;
  for (const c of commits) {
    if (c.parents.length > 1) merges++;
    for (const f of c.files) {
      if (isNoise(f.path)) continue;
      if (f.added > 0) added += f.added;
      if (f.deleted > 0) deleted += f.deleted;
    }
  }
  const langs = new Map<string, { files: number; lines: number }>();
  let linesAlive = 0;
  const alive = lc.alive.filter((l) => !isNoise(l.path));
  for (const l of alive) {
    linesAlive += l.lines;
    const name = language(l.path);
    const e = langs.get(name) ?? { files: 0, lines: 0 };
    e.files++;
    e.lines += l.lines;
    langs.set(name, e);
  }
  // With a truncated window, files untouched inside it never enter the
  // replay; the HEAD tree is the exact source for what is alive today.
  let filesAlive = alive.length;
  if (headLines) {
    const real = [...headLines.entries()].filter(([p]) => !isNoise(p));
    filesAlive = real.length;
    linesAlive = real.reduce((a, [, n]) => a + n, 0);
  }
  return {
    name: h.name,
    branch: h.branch,
    head: h.head,
    firstCommit: commits[0]?.time ?? 0,
    lastCommit: commits[commits.length - 1]?.time ?? 0,
    commits: commits.length,
    merges,
    contributors,
    filesAlive,
    filesDead: lc.dead.filter((l) => !isNoise(l.path)).length,
    linesAlive,
    linesAdded: added,
    linesDeleted: deleted,
    tags: h.tags.length,
    truncated,
    languages: [...langs.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 12),
  };
}

function archive(h: RepoHistory, limit: number): ArchiveEntry[] {
  return h.commits.slice(-limit).reverse().map((c) => {
    let ad = 0;
    let de = 0;
    for (const f of c.files) {
      ad += Math.max(0, f.added);
      de += Math.max(0, f.deleted);
    }
    return { h: c.hash.slice(0, 10), t: c.time, a: c.author, s: c.subject, f: c.files.length, ad, de, m: classify(c.subject) };
  });
}

/** Run every analysis pass and assemble the museum catalogue. */
export async function analyze(raw: RepoHistory, opts: AnalyzeOptions): Promise<Report> {
  const log = opts.log ?? (() => {});
  const canonical = canonicalAuthors(raw.commits);
  const h: RepoHistory = { ...raw, commits: raw.commits.map((c) => ({ ...c, author: canonical.get(c.author) ?? c.author })) };
  const commits = h.commits;
  const truncated = opts.truncated ?? false;

  log("Replaying file lifecycles");
  const windows = frameWindows(commits);
  let lc = trackLifecycles(commits, windows.ends);
  let headLines: Map<string, number> | undefined;
  if (lc.all.some((l) => l.preexisting)) {
    // Truncated history: replay again with true starting sizes.
    log("Measuring files that predate the excavation window");
    headLines = await countLines(opts.repoDir, h.head);
    lc = trackLifecycles(commits, windows.ends, seedLines(lc, headLines));
  }

  log("Charting the timeline and eras");
  const months = monthlySeries(commits);
  const eras = buildEras(commits, months, h.tags, lc, truncated);

  log("Digging the graveyard");
  const graveyard = buildGraveyard(commits, lc);

  log("Surveying the battlefield");
  const battlefield = buildBattlefield(commits, lc);

  log("Painting contributor portraits");
  const people = buildContributors(commits, lc);

  log("Mapping constellations");
  const couplings = buildCouplings(commits, lc);

  log("Listening to the rhythm");
  const rhythm = buildRhythm(commits);

  log("Excavating survivors with git blame");
  const survivors = await buildSurvivors(commits, lc, {
    repoDir: opts.repoDir,
    head: h.head,
    maxFiles: opts.blameFiles,
    canonical,
    onProgress: (done, total) => log(`Excavating survivors with git blame (${done}/${total})`),
  });

  log("Filming the timelapse");
  const timelapse = buildTimelapse(commits, lc, windows.starts);

  const report: Report = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    overview: overview(h, lc, people.list.length + people.others, truncated, headLines),
    months,
    eras,
    milestones: buildMilestones(commits, h.tags, lc, truncated),
    graveyard,
    survivors,
    battlefield,
    contributors: people.list,
    otherContributors: people.others,
    couplings,
    rhythm,
    timelapse,
    archive: archive(h, opts.archiveLimit ?? 3000),
    narrative: { source: "offline", prologue: "", eras: [], epilogue: "", placards: {} },
  };
  report.narrative = offlineNarrative(report);
  return report;
}
