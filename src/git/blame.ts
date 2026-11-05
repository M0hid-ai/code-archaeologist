import { git } from "./run.js";

export interface BlameLine {
  hash: string;
  author: string;
  time: number;
  content: string;
}

/** Parse `git blame --line-porcelain` output into one record per line. */
export function parseBlame(out: string): BlameLine[] {
  const lines: BlameLine[] = [];
  let hash = "";
  let author = "";
  let time = 0;
  for (const raw of out.split("\n")) {
    if (raw.startsWith("\t")) {
      lines.push({ hash, author, time, content: raw.slice(1) });
    } else if (/^[0-9a-f]{40} \d+ \d+/.test(raw)) {
      hash = raw.slice(0, 40);
    } else if (raw.startsWith("author ")) {
      author = raw.slice(7);
    } else if (raw.startsWith("author-time ")) {
      time = Number(raw.slice(12));
    }
  }
  return lines;
}

/** Blame `path` at `rev`, following line moves within the file. */
export async function blame(cwd: string, path: string, rev = "HEAD"): Promise<BlameLine[]> {
  const out = await git(cwd, ["blame", "--line-porcelain", "-w", rev, "--", path]);
  return parseBlame(out);
}
