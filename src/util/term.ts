/** Minimal ANSI styling that respects NO_COLOR and non-TTY output. */
const enabled = !process.env.NO_COLOR && (process.stdout.isTTY || !!process.env.FORCE_COLOR);

const wrap = (open: number, close: number) => (s: string | number) => (enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  gold: wrap(33, 39),
  green: wrap(32, 39),
  red: wrap(31, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
};

/** Overwrite the current line (progress output). */
export function status(line: string): void {
  if (process.stdout.isTTY) process.stdout.write(`\r\x1b[2K${line}`);
}

export function endStatus(): void {
  if (process.stdout.isTTY) process.stdout.write("\r\x1b[2K");
}
