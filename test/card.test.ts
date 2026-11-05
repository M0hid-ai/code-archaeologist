import { test } from "node:test";
import assert from "node:assert/strict";
import { readHistory } from "../src/git/history.js";
import { analyze } from "../src/analysis/index.js";
import { renderCard } from "../src/render/card.js";
import { storyRepo } from "./fixture.js";

test("renderCard produces a self-contained, escaped SVG", async () => {
  const repo = storyRepo();
  try {
    const r = await analyze(await readHistory(repo.dir), { repoDir: repo.dir });
    r.overview.name = 'evil<script>&"name"';
    const svg = renderCard(r);
    assert.ok(svg.startsWith("<svg"));
    assert.ok(svg.includes("commits"));
    assert.ok(svg.includes("evil&lt;script&gt;&amp;"));
    assert.ok(!svg.includes("<script>"));
    assert.ok(!/href=|xlink|url\(http/.test(svg), "no external resources");
  } finally {
    repo.cleanup();
  }
});
