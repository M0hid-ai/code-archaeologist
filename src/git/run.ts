import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

export class GitError extends Error {
  constructor(
    message: string,
    readonly args: string[],
    readonly code: number | null,
    readonly stderr: string,
  ) {
    super(message);
    this.name = "GitError";
  }
}

const BASE_ARGS = ["-c", "core.quotepath=off", "-c", "color.ui=never", "--no-pager"];

/** Run git and resolve with its full stdout. Use for small outputs only. */
export function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", [...BASE_ARGS, ...args], { cwd, windowsHide: true });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", (e) => reject(new GitError(`failed to start git: ${e.message}`, args, null, "")));
    child.on("close", (code) => {
      const stderr = Buffer.concat(err).toString("utf8");
      if (code !== 0) {
        reject(new GitError(`git ${args[0]} exited with ${code}: ${stderr.trim()}`, args, code, stderr));
      } else {
        resolve(Buffer.concat(out).toString("utf8"));
      }
    });
  });
}

/**
 * Run git and feed its stdout to `onLine` one line at a time, so that
 * histories with hundreds of thousands of commits never sit in memory as
 * one giant string.
 */
export function gitLines(cwd: string, args: string[], onLine: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", [...BASE_ARGS, ...args], { cwd, windowsHide: true });
    const err: Buffer[] = [];
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", (e) => reject(new GitError(`failed to start git: ${e.message}`, args, null, "")));
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on("line", onLine);
    let closed = false;
    let exitCode: number | null = null;
    const finish = () => {
      if (!closed || exitCode === null) return;
      const stderr = Buffer.concat(err).toString("utf8");
      if (exitCode !== 0) reject(new GitError(`git ${args[0]} exited with ${exitCode}: ${stderr.trim()}`, args, exitCode, stderr));
      else resolve();
    };
    rl.on("close", () => {
      closed = true;
      if (exitCode !== null) finish();
    });
    child.on("close", (code) => {
      exitCode = code ?? 1;
      if (closed) finish();
    });
  });
}

/** True when `dir` is inside a git work tree. */
export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    return (await git(dir, ["rev-parse", "--is-inside-work-tree"])).trim() === "true";
  } catch {
    return false;
  }
}
