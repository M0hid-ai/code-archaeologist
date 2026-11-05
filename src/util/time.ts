/** Date helpers. All timestamps are unix seconds. */

export const DAY = 86400;

/** "2024-03" style key (UTC). */
export function monthKey(t: number): string {
  const d = new Date(t * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2024-03-05" style key (UTC). */
export function dayKey(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 10);
}

/** Unix seconds for the first instant of the month containing `t`. */
export function monthStart(t: number): number {
  const d = new Date(t * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
}

/** Unix seconds for the first instant of the month after the one containing `t`. */
export function nextMonth(t: number): number {
  const d = new Date(t * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
}

/** Every month start from the month of `from` through the month of `to`. */
export function monthsBetween(from: number, to: number): number[] {
  const out: number[] = [];
  for (let m = monthStart(from); m <= to; m = nextMonth(m)) out.push(m);
  return out;
}

export function days(seconds: number): number {
  return Math.round(seconds / DAY);
}

/** Human friendly duration: "3 years", "5 months", "12 days". */
export function humanDuration(seconds: number): string {
  const d = seconds / DAY;
  if (d >= 730) return `${Math.round(d / 365)} years`;
  if (d >= 365) return "1 year";
  if (d >= 60) return `${Math.round(d / 30.4)} months`;
  if (d >= 2) return `${Math.round(d)} days`;
  const h = seconds / 3600;
  if (h >= 2) return `${Math.round(h)} hours`;
  const m = Math.max(1, Math.round(seconds / 60));
  return m === 1 ? "1 minute" : `${m} minutes`;
}

export function isoDate(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 10);
}
