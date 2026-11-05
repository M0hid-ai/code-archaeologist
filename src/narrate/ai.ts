import type { Narrative, Report } from "../analysis/report.js";
import { isoDate } from "../util/time.js";

export type AiProvider = "claude" | "gemini";

export interface AiOptions {
  provider: AiProvider;
  model?: string;
  log?: (msg: string) => void;
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  claude: "claude-opus-5-5",
  gemini: "gemini-2.5-flash",
};

const PLACARD_KEYS = ["timeline", "timelapse", "survivors", "strata", "battlefield", "graveyard", "gallery", "constellations", "rhythm", "archive"];

export const SYSTEM_PROMPT = `You are the head curator of a museum dedicated to the history of a single software project.
You write the wall texts: vivid, warm, a little wry, never cheesy, always grounded in the evidence you are given.
Rules:
- Use only facts present in the excavation report. Never invent names, numbers, dates, features or motives.
- You may interpret patterns (e.g. "a burst of fixes suggests a rough release") but phrase interpretation as such.
- Era stories: 3-6 sentences each. Prologue and epilogue: 2-4 sentences. Placards: 1-3 sentences.
- Plain text only, no markdown.
- Respond with a single JSON object and nothing else.`;

/** A compact, model-friendly digest of the report (keeps prompts small). */
export function digest(r: Report): unknown {
  const o = r.overview;
  return {
    project: o.name,
    span: `${isoDate(o.firstCommit)} to ${isoDate(o.lastCommit)}`,
    truncatedHistory: o.truncated,
    totals: {
      commits: o.commits,
      contributors: o.contributors,
      filesAlive: o.filesAlive,
      filesDead: o.filesDead,
      linesAlive: o.linesAlive,
      linesWritten: o.linesAdded,
      linesDeleted: o.linesDeleted,
      releases: o.tags,
    },
    languages: o.languages.slice(0, 6).map((l) => `${l.name} (${l.lines} lines)`),
    eras: r.eras.map((e) => ({
      id: e.id,
      suggestedName: e.name,
      from: isoDate(e.start),
      to: isoDate(e.end),
      commits: e.commits,
      contributors: e.authors,
      leaders: e.topAuthors,
      newcomers: e.newcomers.slice(0, 5),
      departures: e.departures.slice(0, 5),
      linesAdded: e.added,
      linesDeleted: e.deleted,
      filesBorn: e.filesBorn,
      filesDied: e.filesDied,
      workMix: Object.fromEntries(Object.entries(e.moodShare).map(([k, v]) => [k, Math.round((v ?? 0) * 100) + "%"])),
      busiestAreas: e.topDirs,
      releases: e.tags.slice(0, 6),
    })),
    milestones: r.milestones.map((m) => `${isoDate(m.t)} ${m.title}: ${m.detail}`),
    survivors: r.survivors.functions.slice(0, 6).map((f) => ({
      name: f.name,
      file: f.path,
      born: isoDate(f.born),
      by: f.bornBy,
      commitsSurvived: f.commitsSurvived,
      refactorsSurvived: f.refactorsSurvived,
    })),
    strata: r.survivors.strata,
    graveyard: {
      total: r.graveyard.total,
      linesBuried: r.graveyard.linesBuried,
      notable: r.graveyard.tombstones.slice(0, 5).map((t) => ({
        file: t.path,
        lived: `${isoDate(t.born)} to ${isoDate(t.died)}`,
        killedBy: t.killedBy,
        cause: t.cause,
        lastCommit: t.lastWords,
      })),
      zombies: r.graveyard.zombies.length,
      topReapers: r.graveyard.reapers.slice(0, 3),
    },
    battlefield: {
      hotspots: r.battlefield.hotspots.slice(0, 5).map((h) => ({ file: h.path, commits: h.commits, authors: h.authors, fixes: h.fixes })),
      rivalries: r.battlefield.rivalries.slice(0, 3),
      reverts: r.battlefield.reverts.length,
    },
    contributors: r.contributors.slice(0, 8).map((c) => ({
      name: c.name,
      commits: c.commits,
      active: `${isoDate(c.first)} to ${isoDate(c.last)}`,
      archetypes: c.archetypes.map((a) => a.title),
    })),
    rhythm: {
      nightShare: Math.round(r.rhythm.nightShare * 100) + "%",
      weekendShare: Math.round(r.rhythm.weekendShare * 100) + "%",
      busiestDay: r.rhythm.busiestDay,
      longestSilenceDays: r.rhythm.longestSilence?.days ?? 0,
      laziestMessages: r.rhythm.lazyMessages.slice(0, 3),
    },
    couplings: r.couplings.slice(0, 5).map((c) => `${c.a} <-> ${c.b} (${c.together} shared commits)`),
  };
}

export function buildPrompt(r: Report): string {
  return `Here is the excavation report for the project, as JSON:

${JSON.stringify(digest(r))}

Write the museum's wall texts. Return JSON with exactly this shape:
{
  "prologue": string,
  "eras": [{ "id": number, "title": string, "story": string }],   // one per era, same ids; title may refine suggestedName (keep it short, "The ..." style)
  "epilogue": string,
  "placards": { ${PLACARD_KEYS.map((k) => `"${k}": string`).join(", ")} }
}`;
}

/** Pull the first JSON object out of a model response, tolerating code fences. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in model response");
  return JSON.parse(body.slice(start, end + 1));
}

/** Merge a model's answer over the offline narrative, keeping offline text for anything missing or malformed. */
export function mergeNarrative(base: Narrative, raw: unknown, source: Narrative["source"], model: string): Narrative {
  if (!raw || typeof raw !== "object") throw new Error("model returned no object");
  const obj = raw as Record<string, unknown>;
  const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);
  const eras = base.eras.map((e) => {
    const match = Array.isArray(obj.eras)
      ? (obj.eras as Record<string, unknown>[]).find((x) => x && Number(x.id) === e.id)
      : undefined;
    return match ? { id: e.id, title: str(match.title, e.title), story: str(match.story, e.story) } : e;
  });
  const placards = { ...base.placards };
  if (obj.placards && typeof obj.placards === "object") {
    for (const k of PLACARD_KEYS) placards[k] = str((obj.placards as Record<string, unknown>)[k], placards[k] ?? "");
  }
  return {
    source,
    model,
    prologue: str(obj.prologue, base.prologue),
    eras,
    epilogue: str(obj.epilogue, base.epilogue),
    placards,
  };
}

async function askClaude(prompt: string, model: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  // Server-side fallbacks keep the narration going if a request is declined.
  const params = {
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  };
  const response = await client.beta.messages.create(params as any);
  if (response.stop_reason === "refusal") throw new Error("Claude declined to narrate this repository");
  const text = response.content
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { type: string; text?: string }) => b.text ?? "")
    .join("");
  if (!text) throw new Error(`Claude returned no text (stop_reason: ${response.stop_reason})`);
  return text;
}

async function askGemini(prompt: string, model: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

/** Which provider `--ai auto` would pick from the environment, if any. */
export function detectProvider(env: NodeJS.ProcessEnv = process.env): AiProvider | null {
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) return "claude";
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) return "gemini";
  return null;
}

/** Narrate with a model; on any failure, keep the offline narrative and say why. */
export async function aiNarrative(r: Report, opts: AiOptions): Promise<Narrative> {
  const model = opts.model ?? (opts.provider === "gemini" ? process.env.GEMINI_MODEL : process.env.ANTHROPIC_MODEL) ?? DEFAULT_MODELS[opts.provider];
  const prompt = buildPrompt(r);
  try {
    const text = opts.provider === "claude" ? await askClaude(prompt, model) : await askGemini(prompt, model);
    return mergeNarrative(r.narrative, extractJson(text), opts.provider, model);
  } catch (e) {
    opts.log?.(`AI narration failed (${(e as Error).message}); using offline narration.`);
    return r.narrative;
  }
}
