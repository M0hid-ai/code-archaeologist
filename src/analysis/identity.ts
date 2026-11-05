import type { Commit } from "../types.js";

/**
 * People commit under several names and emails over the years
 * ("Ada L.", "ada", "ada@work.com", "ada@home.org"). Union them so every
 * contributor appears once, under the name they used most.
 */
export function canonicalAuthors(commits: Commit[]): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const nameKey = (n: string) => "n:" + n.trim().toLowerCase().replace(/\s+/g, " ");
  const emailKey = (e: string) => "e:" + e.trim().toLowerCase();
  // Generic placeholder emails must not merge unrelated people.
  const genericEmail = (e: string) => !e || /^(none|root|unknown|noreply|no-reply|user)@/.test(e) || !e.includes("@");
  const genericName = (n: string) => /^(unknown|root|user|admin|github|anonymous)$/i.test(n.trim());

  for (const c of commits) {
    const n = nameKey(c.author);
    if (!parent.has(n)) parent.set(n, n);
    if (!genericEmail(c.email)) {
      const e = emailKey(c.email);
      if (!parent.has(e)) parent.set(e, e);
      if (!genericName(c.author)) union(n, e);
    }
  }

  // Most frequently used display name per cluster.
  const nameCounts = new Map<string, Map<string, number>>();
  for (const c of commits) {
    const root = find(nameKey(c.author));
    let m = nameCounts.get(root);
    if (!m) nameCounts.set(root, (m = new Map()));
    m.set(c.author, (m.get(c.author) ?? 0) + 1);
  }
  const display = new Map<string, string>();
  for (const [root, m] of nameCounts) {
    display.set(root, [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
  }

  const result = new Map<string, string>();
  for (const c of commits) {
    if (!result.has(c.author)) result.set(c.author, display.get(find(nameKey(c.author))) ?? c.author);
  }
  return result;
}

/** Return commits with `author` replaced by its canonical display name. */
export function withCanonicalAuthors(commits: Commit[]): Commit[] {
  const map = canonicalAuthors(commits);
  return commits.map((c) => ({ ...c, author: map.get(c.author) ?? c.author }));
}

export function isBot(name: string): boolean {
  return /\[bot\]|\bbot\b|dependabot|renovate|github-actions|greenkeeper|snyk|semantic-release/i.test(name);
}
