import type { Report } from "./analysis/report.js";
import { c } from "./util/term.js";
import { humanDuration, isoDate } from "./util/time.js";

const n = (x: number) => x.toLocaleString("en");

/** A short exhibit guide printed to the terminal after excavation. */
export function summary(r: Report): string {
  const o = r.overview;
  const lines: string[] = [];
  lines.push("");
  lines.push(`  ${c.gold("🏺")} ${c.bold(o.name)} ${c.gray(`${isoDate(o.firstCommit)} → ${isoDate(o.lastCommit)} (${humanDuration(o.lastCommit - o.firstCommit)})`)}`);
  lines.push(
    `     ${c.bold(n(o.commits))} commits · ${c.bold(n(o.contributors))} ${o.contributors === 1 ? "contributor" : "contributors"} · ${c.green("+" + n(o.linesAdded))} ${c.red("-" + n(o.linesDeleted))} · ${c.bold(n(o.linesAlive))} lines alive`,
  );
  if (r.eras.length) {
    lines.push("");
    lines.push(`  ${c.gold("Eras")}`);
    for (const e of r.eras) {
      const title = r.narrative.eras.find((x) => x.id === e.id)?.title ?? e.name;
      lines.push(`     ${c.bold(title.padEnd(26))} ${c.gray(`${isoDate(e.start).slice(0, 7)} – ${isoDate(e.end).slice(0, 7)}`)}  ${n(e.commits)} commits`);
    }
  }
  const s = r.survivors.functions[0];
  if (s) {
    lines.push("");
    lines.push(`  ${c.gold("Toughest survivor")}  ${c.cyan(s.name + "()")} ${c.gray(s.path)}`);
    lines.push(`     born ${isoDate(s.born)} by ${s.bornBy}, survived ${n(s.commitsSurvived)} commits and ${n(s.refactorsSurvived)} refactors`);
  }
  const t = r.graveyard.tombstones[0];
  if (t) {
    lines.push("");
    lines.push(`  ${c.gold("Most notable grave")}  ${c.cyan(t.path)}`);
    lines.push(`     ${c.italic(`"${t.epitaph}"`)}`);
  }
  const h = r.battlefield.hotspots[0];
  if (h) {
    lines.push("");
    lines.push(`  ${c.gold("Hottest battleground")}  ${c.cyan(h.path)} ${c.gray(`${n(h.commits)} commits, ${n(h.authors)} authors, ${n(h.fixes)} fixes`)}`);
  }
  lines.push("");
  lines.push(`  ${c.gray(`narration: ${r.narrative.source === "offline" ? "offline curator" : `${r.narrative.source} (${r.narrative.model})`}`)}`);
  return lines.join("\n");
}
