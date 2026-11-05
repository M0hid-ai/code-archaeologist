/** Commit message classification ("mood"). */

export type Mood = "feature" | "fix" | "refactor" | "docs" | "test" | "chore" | "revert" | "merge" | "panic" | "other";

export const MOODS: Mood[] = ["feature", "fix", "refactor", "docs", "test", "chore", "revert", "merge", "panic", "other"];

const RULES: [Mood, RegExp][] = [
  ["merge", /^merge\b/i],
  ["revert", /^revert\b|\brevert(s|ed)?\b/i],
  ["panic", /\b(oops+|hotfix|urgent|asap|broke(n)?|again|ugh+|wtf|damn|stupid|typo|fixup|hack|emergency|critical)\b|!!+/i],
  ["fix", /\b(fix(es|ed)?|bug(s)?|patch|resolve[sd]?|crash(es)?|issue|error|regression|correct)\b/i],
  ["refactor", /\b(refactor\w*|restructur\w*|rewrit\w*|clean ?up|cleanup|reorganiz\w*|simplif\w*|rename[sd]?|extract\w*|overhaul\w*|moderniz\w*|tidy)\b/i],
  ["test", /\b(tests?|spec(s)?|coverage|testing)\b/i],
  ["docs", /\b(docs?|documentation|readme|comment(s)?|changelog|typos?)\b/i],
  ["chore", /\b(bump|deps?|dependenc(y|ies)|release|version|ci|build|lint|format(ting)?|config|chore|upgrade|update)\b/i],
  ["feature", /\b(add(s|ed)?|implement\w*|introduc\w*|support\w*|new|feat(ure)?s?|create[sd]?|enable[sd]?|allow\w*)\b/i],
];

/** Conventional-commit prefixes win over keyword guessing. */
const CONVENTIONAL: Record<string, Mood> = {
  feat: "feature",
  fix: "fix",
  refactor: "refactor",
  perf: "refactor",
  docs: "docs",
  test: "test",
  chore: "chore",
  build: "chore",
  ci: "chore",
  style: "chore",
  revert: "revert",
};

export function classify(subject: string): Mood {
  const conv = /^(\w+)(\([^)]*\))?!?:/.exec(subject);
  if (conv && CONVENTIONAL[conv[1].toLowerCase()]) return CONVENTIONAL[conv[1].toLowerCase()];
  for (const [mood, re] of RULES) if (re.test(subject)) return mood;
  return "other";
}

const REFACTOR_RE = /\b(refactor\w*|restructur\w*|rewrit\w*|clean ?up|reorganiz\w*|simplif\w*|overhaul\w*|moderniz\w*|migrat\w*|extract\w*|split)\b/i;

export function isRefactor(subject: string): boolean {
  return REFACTOR_RE.test(subject) || /^(refactor|perf)(\(|:|!)/i.test(subject);
}

export function isFix(subject: string): boolean {
  const m = classify(subject);
  return m === "fix" || m === "panic";
}

/** Commit messages that tell you nothing at all. */
export function isLazyMessage(subject: string): boolean {
  const s = subject.trim().toLowerCase();
  if (s.length <= 3) return true;
  return /^(wip|fix|fixes|update|updates|changes|stuff|asdf+|test|tmp|temp|minor|misc|more|cleanup|save|commit|done|ok|\.+|-+|work|lol|idk|whatever|final|final final|try again|again)$/.test(s);
}

/** Extract the original subject from a `Revert "..."` message. */
export function revertedSubject(subject: string): string | null {
  const m = /^Revert "(.*)"$/.exec(subject.trim());
  return m ? m[1] : null;
}
