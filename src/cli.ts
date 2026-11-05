import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyze } from "./analysis/index.js";
import { readHistory } from "./git/history.js";
import { git, isGitRepo } from "./git/run.js";
import { aiNarrative, detectProvider, type AiProvider } from "./narrate/ai.js";
import { writeSite } from "./render/site.js";
import { summary } from "./summary.js";
import { c, endStatus, status } from "./util/term.js";
import { VERSION } from "./version.js";

const HELP = `
${c.gold("🏺 code-archaeologist")} ${c.gray("v" + VERSION)}
Dig up the hidden history of a git repository and exhibit it as a web museum.

${c.bold("Usage")}
  codearch [repo] [options]

  repo                 Path to a local repository (default: current directory)
                       or a git URL to clone into a temporary directory.

${c.bold("Options")}
  -o, --out <dir>        Output directory (default: ./museum)
      --ai <mode>        Narration: auto | claude | gemini | none (default: auto)
      --model <id>       Model to narrate with (default: claude-opus-5-5 / gemini-2.5-flash)
  -n, --max-commits <n>  Only excavate the most recent n commits
      --since <date>     Only commits after this date (e.g. 2020-01-01, "2 years ago")
      --ref <rev>        Branch, tag or commit to excavate (default: HEAD)
      --blame-files <n>  Files to excavate with git blame (default: 150)
      --json             Also write report.json next to index.html
      --open             Open the museum in your browser when done
  -q, --quiet            Only print the output path
  -h, --help             Show this help
  -v, --version          Show the version

${c.bold("AI narration")}
  Offline narration is always available. With --ai auto (the default), the
  curator uses Claude when ANTHROPIC_API_KEY is set, otherwise Gemini when
  GEMINI_API_KEY is set. Only aggregate statistics are sent, never source code.

${c.bold("Examples")}
  codearch
  codearch ../my-project --open
  codearch https://github.com/expressjs/express -o express-museum
  codearch . --since "3 years ago" --ai none
`;

export interface CliOptions {
  repo: string;
  out: string;
  ai: "auto" | "none" | AiProvider;
  model?: string;
  maxCommits?: number;
  since?: string;
  ref?: string;
  blameFiles?: number;
  json: boolean;
  open: boolean;
  quiet: boolean;
}

export function parseCli(argv: string[]): CliOptions | "help" | "version" {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      ai: { type: "string" },
      model: { type: "string" },
      "max-commits": { type: "string", short: "n" },
      since: { type: "string" },
      ref: { type: "string" },
      "blame-files": { type: "string" },
      json: { type: "boolean" },
      open: { type: "boolean" },
      quiet: { type: "boolean", short: "q" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  if (values.help) return "help";
  if (values.version) return "version";
  if (positionals.length > 1) throw new Error(`expected at most one repository, got ${positionals.length}`);
  const ai = (values.ai ?? "auto").toLowerCase();
  if (!["auto", "none", "claude", "gemini"].includes(ai)) throw new Error(`--ai must be auto, claude, gemini or none (got "${values.ai}")`);
  const int = (name: string, v: string | undefined) => {
    if (v === undefined) return undefined;
    const x = Number(v);
    if (!Number.isInteger(x) || x < 0) throw new Error(`--${name} must be a non-negative integer (got "${v}")`);
    return x;
  };
  return {
    repo: positionals[0] ?? ".",
    out: values.out ?? "museum",
    ai: ai as CliOptions["ai"],
    model: values.model,
    maxCommits: int("max-commits", values["max-commits"]),
    since: values.since,
    ref: values.ref,
    blameFiles: int("blame-files", values["blame-files"]),
    json: !!values.json,
    open: !!values.open,
    quiet: !!values.quiet,
  };
}

export function isRemote(repo: string): boolean {
  return /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(repo) && !existsSync(repo);
}

function openInBrowser(file: string): void {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : process.platform === "darwin" ? ["open", [file]] : ["xdg-open", [file]];
  spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

export async function run(argv: string[]): Promise<number> {
  let opts: ReturnType<typeof parseCli>;
  try {
    opts = parseCli(argv);
  } catch (e) {
    console.error(c.red("error: ") + (e as Error).message);
    console.error(c.gray("Run codearch --help for usage."));
    return 2;
  }
  if (opts === "help") {
    console.log(HELP);
    return 0;
  }
  if (opts === "version") {
    console.log(VERSION);
    return 0;
  }
  const say = (msg: string) => {
    if (!opts.quiet && typeof opts === "object") status(`${c.gold("⛏")}  ${msg}`);
  };

  let repoDir = resolve(opts.repo);
  if (isRemote(opts.repo)) {
    repoDir = join(mkdtempSync(join(tmpdir(), "codearch-")), "repo");
    say(`Cloning ${opts.repo}`);
    await git(tmpdir(), ["clone", "--quiet", opts.repo, repoDir]);
  }
  if (!(await isGitRepo(repoDir))) {
    endStatus();
    console.error(c.red("error: ") + `${repoDir} is not inside a git repository`);
    return 1;
  }

  const t0 = Date.now();
  say("Reading history");
  const history = await readHistory(repoDir, {
    ref: opts.ref,
    maxCommits: opts.maxCommits,
    since: opts.since,
    onProgress: (k) => say(`Reading history: ${k.toLocaleString("en")} commits`),
  });
  if (history.commits.length === 0) {
    endStatus();
    console.error(c.red("error: ") + "no commits found to excavate");
    return 1;
  }
  const report = await analyze(history, {
    repoDir,
    truncated: !!(opts.maxCommits || opts.since),
    blameFiles: opts.blameFiles,
    log: say,
  });

  const provider: AiProvider | null = opts.ai === "auto" ? detectProvider() : opts.ai === "none" ? null : opts.ai;
  if (provider) {
    say(`The curator (${provider}) is writing the placards`);
    report.narrative = await aiNarrative(report, {
      provider,
      model: opts.model,
      log: (m) => {
        endStatus();
        console.warn(c.gold("warning: ") + m);
      },
    });
  }

  say("Hanging the exhibits");
  const file = await writeSite(report, resolve(opts.out), { json: opts.json });
  endStatus();
  if (opts.quiet) {
    console.log(file);
  } else {
    console.log(summary(report));
    console.log(`\n  ${c.green("✔")} Museum opened in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${c.bold(file)}\n`);
  }
  if (opts.open) openInBrowser(file);
  return 0;
}
