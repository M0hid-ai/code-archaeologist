import type { Commit, FileChange } from "../src/types.js";

let seq = 0;

/** Unix seconds for a UTC date. */
export const at = (y: number, m: number, d = 1, h = 12) => Date.UTC(y, m - 1, d, h) / 1000;

/** Build a synthetic commit; files are given as [status, path, added, deleted, oldPath?]. */
export function commit(
  author: string,
  time: number,
  subject: string,
  files: [FileChange["status"], string, number?, number?, string?][] = [],
  extra: Partial<Commit> = {},
): Commit {
  const d = new Date(time * 1000);
  return {
    hash: (++seq).toString(16).padStart(40, "0"),
    parents: [],
    author,
    email: `${author.toLowerCase()}@example.com`,
    time,
    localHour: d.getUTCHours(),
    localWeekday: d.getUTCDay(),
    subject,
    files: files.map(([status, path, added = 0, deleted = 0, oldPath]) => ({
      status,
      path,
      added,
      deleted,
      ...(oldPath ? { oldPath } : {}),
    })),
    ...extra,
  };
}
