import { gitLines } from "./run.js";

/**
 * Line count of every text file at `rev`, via `git grep -c ''` (fast, reads
 * blobs straight from the object store, skips binaries with -I).
 * Empty files do not appear in git grep output and are simply absent.
 */
export async function countLines(cwd: string, rev: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const prefix = `${rev}:`;
  try {
    await gitLines(cwd, ["grep", "-I", "-c", "--no-color", "-e", "", rev, "--"], (line) => {
      const body = line.startsWith(prefix) ? line.slice(prefix.length) : line;
      const i = body.lastIndexOf(":");
      if (i <= 0) return;
      const n = Number(body.slice(i + 1));
      if (Number.isFinite(n)) counts.set(body.slice(0, i), n);
    });
  } catch {
    // git grep exits 1 when nothing matches (e.g. an empty tree): no counts.
  }
  return counts;
}
