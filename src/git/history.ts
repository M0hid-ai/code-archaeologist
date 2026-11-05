import { basename } from "node:path";
import type { RepoHistory, Tag } from "../types.js";
import { LOG_FORMAT, LogParser } from "./parse.js";
import { git, gitLines } from "./run.js";

export interface HistoryOptions {
  /** Revision to walk (default: HEAD). */
  ref?: string;
  /** Keep only the most recent N commits (0 = everything). */
  maxCommits?: number;
  /** Only commits after this date (anything `git log --since` accepts). */
  since?: string;
  /** Called every 1000 commits so the CLI can show progress. */
  onProgress?: (count: number) => void;
}

/** Root directory of the work tree containing `dir`. */
export async function repoRoot(dir: string): Promise<string> {
  return (await git(dir, ["rev-parse", "--show-toplevel"])).trim();
}

export async function readTags(dir: string): Promise<Tag[]> {
  let out = "";
  try {
    out = await git(dir, [
      "for-each-ref",
      "refs/tags",
      "--format=%(refname:short)%09%(creatordate:unix)%09%(*objectname)%09%(objectname)",
    ]);
  } catch {
    return [];
  }
  const tags: Tag[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const [name, time, peeled, obj] = line.split("\t");
    tags.push({ name, time: Number(time) || 0, hash: peeled || obj });
  }
  return tags.sort((a, b) => a.time - b.time);
}

/** Walk the history of `dir` and return every commit, oldest first. */
export async function readHistory(dir: string, opts: HistoryOptions = {}): Promise<RepoHistory> {
  const root = await repoRoot(dir);
  const ref = opts.ref ?? "HEAD";
  const head = (await git(root, ["rev-parse", ref])).trim();
  let branch = ref;
  try {
    branch = (await git(root, ["rev-parse", "--abbrev-ref", ref])).trim() || ref;
  } catch {
    /* detached or exotic ref: keep the ref as given */
  }

  const args = ["log", ref, "--raw", "--numstat", "-M", `--format=${LOG_FORMAT}`, "--no-color", "--date-order"];
  if (opts.maxCommits && opts.maxCommits > 0) args.push(`--max-count=${opts.maxCommits}`);
  if (opts.since) args.push(`--since=${opts.since}`);

  const parser = new LogParser();
  let seen = 0;
  await gitLines(root, args, (line) => {
    if (line.charCodeAt(0) === 0x1e) {
      seen++;
      if (opts.onProgress && seen % 1000 === 0) opts.onProgress(seen);
    }
    parser.push(line);
  });
  const commits = parser.finish().reverse();
  const tags = await readTags(root);
  return { name: basename(root), commits, tags, head, branch };
}
