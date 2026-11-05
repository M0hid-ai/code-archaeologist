/** Helpers for classifying paths. */

const NOISE_PATTERNS: RegExp[] = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)npm-shrinkwrap\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)bun\.lockb?$/,
  /(^|\/)Cargo\.lock$/,
  /(^|\/)go\.sum$/,
  /(^|\/)poetry\.lock$/,
  /(^|\/)Pipfile\.lock$/,
  /(^|\/)composer\.lock$/,
  /(^|\/)Gemfile\.lock$/,
  /(^|\/)mix\.lock$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.snap$/,
  /(^|\/)(node_modules|vendor|dist|build|out|target|\.next|coverage)\//,
];

/** Lockfiles, build output and vendored code: real churn, but not real history. */
export function isNoise(path: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(path));
}

const BOOKKEEPING =
  /(^|\/)(changelog|changes|history|news|releases?|authors|contributors|version)(\.(md|markdown|txt|rst|adoc))?$|(^|\/)(package\.json|pyproject\.toml|setup\.py|setup\.cfg|cargo\.toml|go\.mod|composer\.json|pom\.xml|build\.gradle(\.kts)?|gemfile|\.[\w-]*rc(\.json|\.ya?ml|\.js|\.cjs)?|\.gitignore|\.gitattributes|\.travis\.yml|appveyor\.yml|azure-pipelines\.yml|\.gitlab-ci\.yml|jenkinsfile|license(\.\w+)?)$|(^|\/)\.(github|circleci)\//i;

/**
 * Release bookkeeping (changelogs, manifests, version files, CI config):
 * touched by every release, so it dominates hotspot and coupling rankings
 * without telling a story about the code itself.
 */
export function isBookkeeping(path: string): boolean {
  return BOOKKEEPING.test(path);
}

const LANGUAGES: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", pyi: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin", kts: "Kotlin",
  scala: "Scala",
  swift: "Swift",
  m: "Objective-C", mm: "Objective-C",
  c: "C", h: "C",
  cc: "C++", cpp: "C++", cxx: "C++", hpp: "C++", hh: "C++",
  cs: "C#",
  fs: "F#",
  rb: "Ruby",
  php: "PHP",
  lua: "Lua",
  dart: "Dart",
  ex: "Elixir", exs: "Elixir",
  erl: "Erlang",
  hs: "Haskell",
  clj: "Clojure",
  zig: "Zig",
  r: "R",
  jl: "Julia",
  sh: "Shell", bash: "Shell", zsh: "Shell", ps1: "PowerShell",
  sql: "SQL",
  html: "HTML", htm: "HTML",
  css: "CSS", scss: "CSS", sass: "CSS", less: "CSS",
  vue: "Vue", svelte: "Svelte",
  md: "Markdown", mdx: "Markdown", rst: "reStructuredText", txt: "Text",
  json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", xml: "XML",
};

export function extension(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function language(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (name === "Dockerfile") return "Docker";
  if (name === "Makefile") return "Make";
  return LANGUAGES[extension(path)] ?? "Other";
}

const CODE_LANGS = new Set([
  "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "Kotlin", "Scala", "Swift",
  "Objective-C", "C", "C++", "C#", "F#", "Ruby", "PHP", "Lua", "Dart", "Elixir", "Erlang",
  "Haskell", "Clojure", "Zig", "R", "Julia", "Shell", "PowerShell", "Vue", "Svelte",
]);

export function isCode(path: string): boolean {
  return CODE_LANGS.has(language(path));
}

export function isTest(path: string): boolean {
  return /(^|\/)(tests?|__tests__|spec|specs)\//i.test(path) || /[._-](test|spec)\.[a-z]+$/i.test(path) || /(^|\/)test_[^/]+\.py$/.test(path);
}

export function isDoc(path: string): boolean {
  return /(^|\/)docs?\//i.test(path) || /\.(md|mdx|rst|txt|adoc)$/i.test(path);
}

/** First path segment, or "(root)" for top-level files. */
export function topDir(path: string): string {
  const i = path.indexOf("/");
  return i === -1 ? "(root)" : path.slice(0, i);
}

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
