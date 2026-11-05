import { extension } from "../util/files.js";

export interface FunctionDef {
  name: string;
  /** 0-based line index of the signature. */
  line: number;
}

type Matcher = (line: string) => string | null;

const first = (re: RegExp, group = 1): Matcher => (line) => {
  const m = re.exec(line);
  return m ? m[group] : null;
};

const anyOf = (...ms: Matcher[]): Matcher => (line) => {
  for (const m of ms) {
    const r = m(line);
    if (r) return r;
  }
  return null;
};

const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "function", "else", "do", "new", "typeof", "await", "sizeof", "delete", "throw", "case", "with", "elif", "match"]);

const JS = anyOf(
  first(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*[<(]/),
  first(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/),
  first(/^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/),
  (line) => {
    const m = /^\s+(?:(?:public|private|protected|static|readonly|async|override|get|set)\s+)*\*?([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\([^)]*\)?\s*(?::\s*[^{]+)?\{\s*$/.exec(line);
    return m && !KEYWORDS.has(m[1]) ? m[1] : null;
  },
);

const PY = anyOf(first(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/), first(/^\s*class\s+([A-Za-z_]\w*)/));
const GO = first(/^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*[(\[]/);
const RUST = anyOf(
  first(/^\s*(?:pub(?:\([^)]*\))?\s+)?(?:const\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+([A-Za-z_]\w*)/),
  first(/^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait)\s+([A-Za-z_]\w*)/),
);
const RUBY = anyOf(first(/^\s*def\s+(?:self\.)?([A-Za-z_]\w*[?!=]?)/), first(/^\s*(?:class|module)\s+([A-Z]\w*)/));
const PHP = anyOf(first(/^\s*(?:(?:public|private|protected|static|abstract|final)\s+)*function\s+&?([A-Za-z_]\w*)\s*\(/), first(/^\s*(?:abstract\s+|final\s+)?class\s+([A-Za-z_]\w*)/));
const CLIKE = anyOf(
  first(/^\s*(?:public|private|protected|internal)?\s*(?:abstract\s+|final\s+|sealed\s+|static\s+|data\s+|open\s+)*(?:class|interface|enum|struct|record|object)\s+([A-Za-z_]\w*)/),
  first(/^\s*(?:(?:public|private|protected|internal|static|final|abstract|synchronized|override|virtual|async|inline|extern|const|constexpr|suspend|open)\s+)*fun\s+(?:<[^>]*>\s*)?(?:[\w.]+\.)?([A-Za-z_]\w*)\s*\(/),
  (line) => {
    const m = /^\s*(?:(?:public|private|protected|internal|static|final|abstract|synchronized|override|virtual|async|inline|extern|const|constexpr|unsigned|signed)\s+)*[A-Za-z_][\w<>,\[\]\s\*&:.?]*?\s+\**&?([A-Za-z_~][\w:~]*)\s*\([^;]*$/.exec(line);
    if (!m) return null;
    const name = m[1].split("::").pop()!;
    return KEYWORDS.has(name) || /^(else|return)$/.test(name) ? null : name;
  },
);
const SWIFT = anyOf(first(/^\s*(?:@\w+\s+)*(?:(?:public|private|internal|fileprivate|open|static|override|final|mutating)\s+)*func\s+([A-Za-z_]\w*)/), first(/^\s*(?:(?:public|private|internal|final|open)\s+)*(?:class|struct|enum|protocol|extension)\s+([A-Za-z_]\w*)/));
const ELIXIR = first(/^\s*defp?\s+([a-z_]\w*[?!]?)/);
const LUA = first(/^\s*(?:local\s+)?function\s+([\w.:]+)\s*\(/);
const SHELL = anyOf(first(/^\s*function\s+([\w-]+)/), first(/^\s*([\w-]+)\s*\(\)\s*\{/));

const BY_EXT: Record<string, Matcher> = {
  js: JS, jsx: JS, mjs: JS, cjs: JS, ts: JS, tsx: JS, mts: JS, cts: JS, vue: JS, svelte: JS,
  py: PY, pyi: PY,
  go: GO,
  rs: RUST,
  rb: RUBY,
  php: PHP,
  java: CLIKE, kt: CLIKE, kts: CLIKE, scala: CLIKE, cs: CLIKE, c: CLIKE, h: CLIKE, cc: CLIKE, cpp: CLIKE, cxx: CLIKE, hpp: CLIKE, hh: CLIKE, m: CLIKE, mm: CLIKE, dart: CLIKE,
  swift: SWIFT,
  ex: ELIXIR, exs: ELIXIR,
  lua: LUA,
  sh: SHELL, bash: SHELL, zsh: SHELL,
};

export function supportsFunctions(path: string): boolean {
  return extension(path) in BY_EXT;
}

/**
 * Lightweight, regex-based detection of function / class definitions.
 * Not a parser: it aims to find most named definitions in idiomatic code,
 * which is all a museum placard needs.
 */
export function findFunctions(path: string, lines: string[]): FunctionDef[] {
  const matcher = BY_EXT[extension(path)];
  if (!matcher) return [];
  const out: FunctionDef[] = [];
  let inBlockComment = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      return;
    }
    // Line comments, doc-comment continuations, preprocessor lines and attributes.
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) return;
    if (line.length > 300) return;
    const name = matcher(line);
    if (name && name.length > 1) out.push({ name, line: i });
  });
  return out;
}
