import type { ChangeStatus, Commit, FileChange } from "../types.js";

/** Record separator / unit separator used in our `--format` string. */
export const RS = "\x1e";
export const US = "\x1f";

/**
 * `git log` pretty format consumed by {@link LogParser}.
 * %aN / %aE honour .mailmap so aliases collapse automatically.
 */
export const LOG_FORMAT = `${RS}%H${US}%P${US}%aN${US}%aE${US}%at${US}%aI${US}%s`;

interface RawEntry {
  status: ChangeStatus;
  path: string;
  oldPath?: string;
}

interface NumEntry {
  added: number;
  deleted: number;
  path: string;
}

/** Strip git's C-style quoting from a path (only used when quotepath is on). */
export function unquotePath(p: string): string {
  if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) {
    return p.slice(1, -1).replace(/\\(["\\])/g, "$1").replace(/\\t/g, "\t").replace(/\\n/g, "\n");
  }
  return p;
}

/** Parse one `--raw` line, e.g. `:100644 100644 abc def R087\told\tnew`. */
export function parseRawLine(line: string): RawEntry | null {
  if (!line.startsWith(":")) return null;
  const parts = line.split("\t");
  const meta = parts[0].split(" ");
  const code = meta[meta.length - 1] ?? "";
  const letter = code.charAt(0) as ChangeStatus;
  if (!"AMDRCT".includes(letter) || letter === ("" as ChangeStatus)) return null;
  if ((letter === "R" || letter === "C") && parts.length >= 3) {
    return { status: letter, oldPath: unquotePath(parts[1]), path: unquotePath(parts[2]) };
  }
  if (parts.length < 2) return null;
  return { status: letter, path: unquotePath(parts[1]) };
}

/** Parse one `--numstat` line, e.g. `12\t3\tsrc/a.ts` or `-\t-\timg.png`. */
export function parseNumstatLine(line: string): NumEntry | null {
  const m = /^(\d+|-)\t(\d+|-)\t(.*)$/.exec(line);
  if (!m) return null;
  return {
    added: m[1] === "-" ? -1 : Number(m[1]),
    deleted: m[2] === "-" ? -1 : Number(m[2]),
    path: m[3],
  };
}

/** Local hour + weekday from an ISO-8601 timestamp that carries its own offset. */
export function localClock(iso: string): { hour: number; weekday: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(iso);
  if (!m) return { hour: 0, weekday: 0 };
  const weekday = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return { hour: Number(m[4]), weekday };
}

/**
 * Incremental parser for `git log --raw --numstat --format=LOG_FORMAT`.
 * Feed it lines with {@link push}; collect the commits with {@link finish}.
 * Git prints the raw block and then the numstat block for every commit, in
 * the same file order, so the two are zipped together by position.
 */
export class LogParser {
  private commits: Commit[] = [];
  private current: Commit | null = null;
  private raw: RawEntry[] = [];
  private nums: NumEntry[] = [];

  push(line: string): void {
    if (line.startsWith(RS)) {
      this.flush();
      const f = line.slice(1).split(US);
      const clock = localClock(f[5] ?? "");
      this.current = {
        hash: f[0],
        parents: f[1] ? f[1].split(" ").filter(Boolean) : [],
        author: f[2] || "unknown",
        email: (f[3] || "").toLowerCase(),
        time: Number(f[4]) || 0,
        localHour: clock.hour,
        localWeekday: clock.weekday,
        subject: f.slice(6).join(US),
        files: [],
      };
      return;
    }
    if (!this.current || line.length === 0) return;
    if (line.startsWith(":")) {
      const r = parseRawLine(line);
      if (r) this.raw.push(r);
      return;
    }
    const n = parseNumstatLine(line);
    if (n) this.nums.push(n);
  }

  private flush(): void {
    if (!this.current) return;
    const files: FileChange[] = [];
    const aligned = this.raw.length === this.nums.length;
    for (let i = 0; i < this.raw.length; i++) {
      const r = this.raw[i];
      let n: NumEntry | undefined = aligned ? this.nums[i] : undefined;
      if (!n) n = this.nums.find((x) => x.path === r.path);
      files.push({
        path: r.path,
        ...(r.oldPath !== undefined ? { oldPath: r.oldPath } : {}),
        status: r.status,
        added: n ? n.added : 0,
        deleted: n ? n.deleted : 0,
      });
    }
    this.current.files = files;
    this.commits.push(this.current);
    this.current = null;
    this.raw = [];
    this.nums = [];
  }

  /** Returns the parsed commits in the order git printed them. */
  finish(): Commit[] {
    this.flush();
    return this.commits;
  }
}
