import type { Report } from "../analysis/report.js";
import { humanDuration } from "../util/time.js";

const xml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
  if (n >= 1e4) return Math.round(n / 1e3) + "k";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * A small, README-friendly SVG card summarising the museum. Uses only
 * system fonts and no external resources, so it renders anywhere
 * (including GitHub's image proxy).
 */
export function renderCard(r: Report): string {
  const o = r.overview;
  const W = 520;
  const H = 190;
  const stats: [string, string][] = [
    [humanDuration(o.lastCommit - o.firstCommit), "of history"],
    [compact(o.commits), "commits"],
    [compact(o.contributors), o.contributors === 1 ? "contributor" : "contributors"],
    [compact(o.filesDead), "files buried"],
  ];
  const s = r.survivors.functions[0];
  const g = r.graveyard.tombstones[0];
  const tagline = s
    ? `Toughest survivor: ${s.name}() · ${s.commitsSurvived} commits, ${s.refactorsSurvived} refactors`
    : g
      ? `Most notable grave: ${g.path}`
      : `${compact(o.linesAlive)} lines alive across ${compact(o.filesAlive)} files`;
  const colW = (W - 48) / stats.length;
  const serif = `'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif`;
  const sans = `system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${xml(`${o.name}: ${o.commits} commits, ${o.contributors} contributors, ${o.filesDead} files buried`)}">
  <defs>
    <radialGradient id="glow" cx="20%" cy="0%" r="90%">
      <stop offset="0" stop-color="#d9b45a" stop-opacity=".18"/>
      <stop offset="1" stop-color="#d9b45a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="14" fill="#121211"/>
  <rect width="${W}" height="${H}" rx="14" fill="url(#glow)"/>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="13.5" fill="none" stroke="#383835"/>
  <text x="24" y="34" fill="#d9b45a" font-family="${sans}" font-size="11" letter-spacing="2.5">🏺 A MUSEUM OF CODE HISTORY</text>
  <text x="24" y="72" fill="#f0efec" font-family="${serif}" font-size="32" font-weight="600">${xml(clip(o.name, 26))}</text>
${stats
  .map(
    ([v, k], i) => `  <text x="${24 + i * colW}" y="118" fill="#f0efec" font-family="${serif}" font-size="24">${xml(v)}</text>
  <text x="${24 + i * colW}" y="136" fill="#8f8e86" font-family="${sans}" font-size="11">${xml(k)}</text>`,
  )
  .join("\n")}
  <line x1="24" y1="154" x2="${W - 24}" y2="154" stroke="#383835"/>
  <text x="24" y="174" fill="#c3c2b7" font-family="${sans}" font-size="12">${xml(clip(tagline, 78))}</text>
</svg>
`;
}
