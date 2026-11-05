import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, detectProvider, extractJson, mergeNarrative } from "../src/narrate/ai.js";
import type { Narrative } from "../src/analysis/report.js";
import { readHistory } from "../src/git/history.js";
import { analyze } from "../src/analysis/index.js";
import { storyRepo } from "./fixture.js";

const base: Narrative = {
  source: "offline",
  prologue: "offline prologue",
  eras: [
    { id: 0, title: "The Founding", story: "offline 0" },
    { id: 1, title: "The Present Day", story: "offline 1" },
  ],
  epilogue: "offline epilogue",
  placards: { graveyard: "offline graveyard", timeline: "offline timeline" },
};

test("extractJson tolerates fences and chatter", () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('noise {"b": {"c": 2}} trailing'), { b: { c: 2 } });
  assert.throws(() => extractJson("no json here"));
});

test("mergeNarrative keeps offline text for missing fields", () => {
  const merged = mergeNarrative(
    base,
    { prologue: "AI prologue", eras: [{ id: 1, title: "The Long Now", story: "AI story" }], placards: { graveyard: "AI graves" } },
    "claude",
    "claude-opus-5-5",
  );
  assert.equal(merged.source, "claude");
  assert.equal(merged.prologue, "AI prologue");
  assert.equal(merged.epilogue, "offline epilogue");
  assert.equal(merged.eras[0].story, "offline 0");
  assert.equal(merged.eras[1].title, "The Long Now");
  assert.equal(merged.placards.graveyard, "AI graves");
  assert.equal(merged.placards.timeline, "offline timeline");
  assert.throws(() => mergeNarrative(base, null, "gemini", "x"));
});

test("detectProvider prefers Claude, then Gemini", () => {
  assert.equal(detectProvider({ ANTHROPIC_API_KEY: "k", GEMINI_API_KEY: "g" }), "claude");
  assert.equal(detectProvider({ GEMINI_API_KEY: "g" }), "gemini");
  assert.equal(detectProvider({ GOOGLE_API_KEY: "g" }), "gemini");
  assert.equal(detectProvider({}), null);
});

test("buildPrompt embeds a compact digest without emails", async () => {
  const repo = storyRepo();
  try {
    const r = await analyze(await readHistory(repo.dir), { repoDir: repo.dir });
    const prompt = buildPrompt(r);
    assert.ok(prompt.includes('"project"'));
    assert.ok(prompt.includes("Ada"));
    assert.ok(!prompt.includes("@example.com"));
    assert.ok(prompt.length < 20000);
  } finally {
    repo.cleanup();
  }
});
