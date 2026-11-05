import type { Commit } from "../types.js";
import type { Rhythm } from "./report.js";
import { classify, isLazyMessage, MOODS, type Mood } from "../util/messages.js";
import { bump, top } from "../util/stats.js";
import { dayKey, DAY } from "../util/time.js";

const STOP_WORDS = new Set(["the", "a", "an", "to", "of", "and", "in", "for", "on", "is", "with"]);

/** When people commit, how they feel about it, and how they write about it. */
export function buildRhythm(commits: Commit[]): Rhythm {
  const heatmap = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const moods = new Map<Mood, number>();
  const lazy = new Map<string, number>();
  const words = new Map<string, number>();
  const perDay = new Map<string, number>();
  let longest: Rhythm["longestMessage"] = null;
  let subjectLen = 0;
  let night = 0;
  let weekend = 0;
  let silence: Rhythm["longestSilence"] = null;

  commits.forEach((c) => {
    heatmap[c.localWeekday][c.localHour]++;
    const mood = classify(c.subject);
    bump(moods, mood);
    if (mood !== "merge") {
      if (isLazyMessage(c.subject)) bump(lazy, c.subject.trim().toLowerCase() || "(empty)");
      const first = c.subject.trim().split(/[\s:(]+/)[0]?.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (first && !STOP_WORDS.has(first)) bump(words, first);
      if (!longest || c.subject.length > longest.subject.length) longest = { subject: c.subject, by: c.author, t: c.time };
    }
    subjectLen += c.subject.length;
    if (c.localHour < 5) night++;
    if (c.localWeekday === 0 || c.localWeekday === 6) weekend++;
    bump(perDay, dayKey(c.time));
  });

  // Author dates are not monotonic in log order (rebases, cherry-picks), so
  // measure silences on the sorted timeline.
  const times = commits.map((c) => c.time).sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (!silence || gap > silence.to - silence.from) silence = { from: times[i - 1], to: times[i], days: Math.round(gap / DAY) };
  }

  const busiest = top(perDay, 1)[0];
  const n = Math.max(1, commits.length);
  return {
    heatmap,
    moods: MOODS.map((mood) => ({ mood, count: moods.get(mood) ?? 0 })).filter((m) => m.count > 0),
    lazyMessages: top(lazy, 12).map(([subject, count]) => ({ subject, count })),
    longestMessage: longest,
    firstWords: top(words, 15).map(([word, count]) => ({ word, count })),
    averageSubjectLength: Math.round(subjectLen / n),
    nightShare: night / n,
    weekendShare: weekend / n,
    busiestDay: busiest ? { day: busiest[0], commits: busiest[1] } : null,
    longestSilence: silence && (silence as { days: number }).days >= 1 ? silence : null,
  };
}
