import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isRemote, parseCli, repoNameFromUrl, run } from "../src/cli.js";
import { storyRepo } from "./fixture.js";

test("parseCli applies defaults", () => {
  const o = parseCli([]);
  assert.ok(typeof o === "object");
  assert.equal(o.repo, ".");
  assert.equal(o.out, "museum");
  assert.equal(o.ai, "auto");
  assert.equal(o.json, false);
});

test("parseCli reads every option", () => {
  const o = parseCli(["repo", "-o", "out", "--ai", "Claude", "--model", "m", "-n", "50", "--since", "2020-01-01", "--ref", "dev", "--blame-files", "10", "-x", "vendor/", "--exclude", "*.snap", "--json", "--open", "-q"]);
  assert.deepEqual(o, {
    repo: "repo",
    out: "out",
    ai: "claude",
    model: "m",
    maxCommits: 50,
    since: "2020-01-01",
    ref: "dev",
    blameFiles: 10,
    exclude: ["vendor/", "*.snap"],
    json: true,
    open: true,
    quiet: true,
  });
  assert.equal(parseCli(["--help"]), "help");
  assert.equal(parseCli(["-v"]), "version");
});

test("parseCli rejects bad input", () => {
  assert.throws(() => parseCli(["--ai", "gpt"]), /--ai/);
  assert.throws(() => parseCli(["-n", "ten"]), /max-commits/);
  assert.throws(() => parseCli(["a", "b"]), /at most one/);
});

test("isRemote recognises git URLs", () => {
  assert.ok(isRemote("https://github.com/expressjs/express"));
  assert.ok(isRemote("git@github.com:expressjs/express.git"));
  assert.ok(!isRemote("../local/repo"));
});

test("run builds a museum end to end", async () => {
  const repo = storyRepo();
  const out = mkdtempSync(join(tmpdir(), "codearch-out-"));
  const log = console.log;
  const lines: string[] = [];
  console.log = (...a: unknown[]) => lines.push(a.join(" "));
  try {
    const code = await run([repo.dir, "-o", out, "--ai", "none", "--json", "-q"]);
    assert.equal(code, 0);
    const html = readFileSync(join(out, "index.html"), "utf8");
    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.ok(html.includes('id="museum-data"'));
    assert.ok(!html.includes("{{DATA}}"));
    assert.ok(!html.includes("@example.com"), "emails must never reach the page");
    assert.ok(existsSync(join(out, "report.json")));
    assert.ok(lines.some((l) => l.endsWith("index.html")));
  } finally {
    console.log = log;
    repo.cleanup();
    rmSync(out, { recursive: true, force: true });
  }
});

test("run fails cleanly outside a repository", async () => {
  const dir = mkdtempSync(join(tmpdir(), "codearch-empty-"));
  const err = console.error;
  console.error = () => {};
  try {
    assert.equal(await run([dir, "-q", "--ai", "none"]), 1);
  } finally {
    console.error = err;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("repoNameFromUrl titles cloned museums after the repository", () => {
  assert.equal(repoNameFromUrl("https://github.com/M0hid-ai/obd2-dash"), "obd2-dash");
  assert.equal(repoNameFromUrl("https://github.com/expressjs/express.git/"), "express");
  assert.equal(repoNameFromUrl("git@github.com:a/b.git"), "b");
  assert.equal(repoNameFromUrl("https://host/"), "host");
  assert.equal(repoNameFromUrl("///"), "repo");
});
