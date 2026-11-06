/**
 * The museum catalogue: everything the analysis passes discover, in a shape
 * that is serialised straight into the generated site.
 */
import type { Mood } from "../util/messages.js";

export interface Overview {
  name: string;
  branch: string;
  head: string;
  firstCommit: number;
  lastCommit: number;
  commits: number;
  merges: number;
  contributors: number;
  filesAlive: number;
  filesDead: number;
  linesAlive: number;
  linesAdded: number;
  linesDeleted: number;
  tags: number;
  /** True when --max-commits / --since cut off the beginning of history. */
  truncated: boolean;
  languages: { name: string; files: number; lines: number }[];
}

export interface MonthPoint {
  /** Unix seconds of the first instant of the month. */
  t: number;
  commits: number;
  added: number;
  deleted: number;
  authors: number;
  moods: Partial<Record<Mood, number>>;
}

export interface Era {
  id: number;
  name: string;
  start: number;
  end: number;
  commits: number;
  authors: number;
  topAuthors: { name: string; commits: number }[];
  newcomers: string[];
  departures: string[];
  added: number;
  deleted: number;
  filesBorn: number;
  filesDied: number;
  moodShare: Partial<Record<Mood, number>>;
  topDirs: string[];
  tags: string[];
  highlights: string[];
}

export interface Milestone {
  t: number;
  kind: string;
  title: string;
  detail: string;
  hash?: string;
}

export interface Tombstone {
  path: string;
  formerNames: string[];
  born: number;
  died: number;
  bornBy: string;
  killedBy: string;
  lines: number;
  peakLines: number;
  commits: number;
  authors: number;
  cause: string;
  epitaph: string;
  lastWords: string;
  zombie: boolean;
}

export interface Graveyard {
  total: number;
  linesBuried: number;
  tombstones: Tombstone[];
  /** Files that were deleted and later brought back. */
  zombies: { path: string; diedAt: number; returnedAt: number; returnedBy: string }[];
  /** Days with the largest number of deaths. */
  massacres: { day: string; deaths: number; by: string; subject: string }[];
  causes: { cause: string; count: number }[];
  /** Who deleted the most files. */
  reapers: { name: string; kills: number }[];
}

export interface SurvivorFunction {
  name: string;
  path: string;
  line: number;
  born: number;
  bornBy: string;
  commitsSurvived: number;
  refactorsSurvived: number;
  authorsTouched: number;
  lines: number;
}

export interface Fossil {
  path: string;
  born: number;
  lastTouched: number;
  bornBy: string;
  commits: number;
  lines: number;
}

export interface Survivors {
  functions: SurvivorFunction[];
  /** Oldest living files. */
  elders: Fossil[];
  /** Living files untouched for the longest time. */
  fossils: Fossil[];
  /** Year -> number of surviving lines first written that year (sampled files). */
  strata: { year: number; label: string; lines: number }[];
  /** Strata are per year, or per month when all surviving code is from a single year. */
  strataUnit: "year" | "month";
  sampledFiles: number;
  sampledLines: number;
}

export interface Hotspot {
  path: string;
  commits: number;
  authors: number;
  churn: number;
  lines: number;
  fixes: number;
  score: number;
  lastTouched: number;
}

export interface Rivalry {
  a: string;
  b: string;
  path: string;
  skirmishes: number;
}

export interface Revert {
  t: number;
  by: string;
  subject: string;
  original?: { t: number; by: string };
  hash: string;
}

export interface Battlefield {
  hotspots: Hotspot[];
  rivalries: Rivalry[];
  reverts: Revert[];
  /** The single commits that changed the most. */
  earthquakes: { t: number; by: string; subject: string; files: number; churn: number; hash: string }[];
}

export interface Contributor {
  name: string;
  bot: boolean;
  commits: number;
  added: number;
  deleted: number;
  filesCreated: number;
  filesDeleted: number;
  first: number;
  last: number;
  activeDays: number;
  topDirs: string[];
  moods: Partial<Record<Mood, number>>;
  /** Commits per month across the whole project, downsampled. */
  sparkline: number[];
  archetypes: { id: string; title: string; reason: string }[];
}

export interface Coupling {
  a: string;
  b: string;
  together: number;
  confidence: number;
  crossDir: boolean;
  alive: boolean;
}

export interface Rhythm {
  /** heatmap[weekday][hour] in authors' local time. */
  heatmap: number[][];
  moods: { mood: Mood; count: number }[];
  lazyMessages: { subject: string; count: number }[];
  longestMessage: { subject: string; by: string; t: number } | null;
  firstWords: { word: string; count: number }[];
  averageSubjectLength: number;
  nightShare: number;
  weekendShare: number;
  busiestDay: { day: string; commits: number } | null;
  longestSilence: { from: number; to: number; days: number } | null;
}

export interface TimelapseFile {
  path: string;
  dir: string;
  lang: string;
}

export interface Timelapse {
  files: TimelapseFile[];
  /** frames[i] = { t, sizes: [fileIndex, lines, ...], stats } */
  frames: {
    t: number;
    sizes: number[];
    commits: number;
    authors: string[];
    born: number;
    died: number;
    totalLines: number;
    totalFiles: number;
  }[];
}

export interface ArchiveEntry {
  h: string;
  t: number;
  a: string;
  s: string;
  f: number;
  ad: number;
  de: number;
  m: Mood;
}

export interface Narrative {
  source: "offline" | "claude" | "gemini";
  model?: string;
  prologue: string;
  eras: { id: number; title: string; story: string }[];
  epilogue: string;
  placards: Record<string, string>;
}

export interface Report {
  version: string;
  generatedAt: string;
  overview: Overview;
  /** Bucket size of `months`: hour, day or month depending on the history's length. */
  seriesUnit: "hour" | "day" | "month";
  months: MonthPoint[];
  eras: Era[];
  milestones: Milestone[];
  graveyard: Graveyard;
  survivors: Survivors;
  battlefield: Battlefield;
  contributors: Contributor[];
  otherContributors: number;
  couplings: Coupling[];
  rhythm: Rhythm;
  timelapse: Timelapse;
  archive: ArchiveEntry[];
  narrative: Narrative;
}
