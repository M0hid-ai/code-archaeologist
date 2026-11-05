import type { RepoHistory } from "../types.js";

/**
 * Translate a gitignore-flavoured glob into a RegExp over repo-relative paths.
 *
 * - `*` matches within a path segment, `**` across segments, `?` one character
 * - a pattern without a slash matches a file or directory name at any depth
 * - a trailing slash (`vendor/`) matches everything below that directory
 * - a leading slash anchors the pattern to the repository root
 */
export function globToRegExp(glob: string): RegExp {
  let g = glob.trim().replace(/\\/g, "/");
  const dirOnly = g.endsWith("/");
  if (dirOnly) g = g.slice(0, -1);
  const anchored = g.startsWith("/");
  if (anchored) g = g.slice(1);
  const floating = !anchored && !g.includes("/");

  let re = "";
  for (let i = 0; i < g.length; i++) {
    const ch = g[i];
    if (ch === "*") {
      if (g[i + 1] === "*") {
        // "**/" matches zero or more directories; a trailing "**" matches anything.
        if (g[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else re += "[^/]*";
    } else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  const prefix = floating ? "(?:^|.*/)" : "^";
  // Matching a directory name also matches everything inside it.
  return new RegExp(`${prefix}${re}(?:/.*)?$`);
}

/** Parse a .codearchignore file: one glob per line, `#` comments, blank lines ignored. */
export function parseIgnoreFile(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

export function pathMatcher(globs: string[]): (path: string) => boolean {
  const res = globs.map(globToRegExp);
  return (path) => res.some((re) => re.test(path));
}

/** Drop every change to an excluded path. Commits stay, so activity still counts. */
export function excludePaths(history: RepoHistory, globs: string[]): RepoHistory {
  if (globs.length === 0) return history;
  const excluded = pathMatcher(globs);
  return {
    ...history,
    commits: history.commits.map((c) => ({
      ...c,
      files: c.files.filter((f) => !excluded(f.path) && !(f.oldPath && excluded(f.oldPath) && excluded(f.path))),
    })),
  };
}
