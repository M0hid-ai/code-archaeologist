import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Report } from "../analysis/report.js";
import { renderCard } from "./card.js";

/** Locate the bundled `web/` directory, both from source and from dist. */
export function webDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/src/render -> ../../../web ; src/render -> ../../web
  for (const rel of ["../../../web", "../../web"]) {
    const p = resolve(here, rel);
    if (existsSync(join(p, "template.html"))) return p;
  }
  return resolve(here, "../../../web");
}

const LINE_SEP = new RegExp(String.fromCharCode(0x2028), "g");
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), "g");

/** Serialise JSON so it is safe inside a <script> element. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEP, "\\u2028")
    .replace(PARA_SEP, "\\u2029");
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Replace a placeholder literally (no `$&` surprises from String.replace). */
function fill(template: string, key: string, value: string): string {
  return template.split(key).join(value);
}

async function readScripts(dir: string): Promise<string> {
  const jsDir = join(dir, "js");
  const files = (await readdir(jsDir)).filter((f) => f.endsWith(".js")).sort();
  const parts = await Promise.all(files.map(async (f) => `/* ${f} */\n${await readFile(join(jsDir, f), "utf8")}`));
  return parts.join("\n");
}

/** Build the complete, self-contained museum page as a string. */
export async function renderHtml(report: Report, dir = webDir()): Promise<string> {
  const [template, styles, script] = await Promise.all([
    readFile(join(dir, "template.html"), "utf8"),
    readFile(join(dir, "styles.css"), "utf8"),
    readScripts(dir),
  ]);
  const o = report.overview;
  let html = template;
  html = fill(html, "{{TITLE}}", escapeHtml(`${o.name} · Code Archaeologist`));
  html = fill(
    html,
    "{{DESCRIPTION}}",
    escapeHtml(`The history of ${o.name}: ${o.commits} commits, ${o.contributors} contributors, ${o.filesDead} files buried.`),
  );
  html = fill(html, "{{VERSION}}", escapeHtml(report.version));
  html = fill(html, "/*{{STYLES}}*/", styles);
  html = fill(html, "/*{{SCRIPT}}*/", script.replace(/<\/script/gi, "<\\/script"));
  html = fill(html, "{{DATA}}", safeJson(report));
  return html;
}

/** Write index.html and card.svg (and optionally report.json) into `outDir`. */
export async function writeSite(report: Report, outDir: string, opts: { json?: boolean } = {}): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const file = join(outDir, "index.html");
  await writeFile(file, await renderHtml(report), "utf8");
  await writeFile(join(outDir, "card.svg"), renderCard(report), "utf8");
  if (opts.json) await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  return file;
}
