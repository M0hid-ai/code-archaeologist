import { test } from "node:test";
import assert from "node:assert/strict";
import { LogParser, RS, US, localClock, parseNumstatLine, parseRawLine, unquotePath } from "../src/git/parse.js";

const header = (hash: string, subject: string, iso = "2024-03-05T23:14:02+05:00", parents = "") =>
  `${RS}${hash}${US}${parents}${US}Ada${US}ADA@x.io${US}1709662442${US}${iso}${US}${subject}`;

test("parseRawLine handles modifications and renames", () => {
  assert.deepEqual(parseRawLine(":100644 100644 abc def M\tsrc/a.ts"), { status: "M", path: "src/a.ts" });
  assert.deepEqual(parseRawLine(":100644 100644 abc def R087\told.ts\tnew.ts"), {
    status: "R",
    oldPath: "old.ts",
    path: "new.ts",
  });
  assert.equal(parseRawLine("not raw"), null);
});

test("parseNumstatLine handles binary files", () => {
  assert.deepEqual(parseNumstatLine("12\t3\tsrc/a.ts"), { added: 12, deleted: 3, path: "src/a.ts" });
  assert.deepEqual(parseNumstatLine("-\t-\tlogo.png"), { added: -1, deleted: -1, path: "logo.png" });
  assert.equal(parseNumstatLine("garbage"), null);
});

test("unquotePath strips git quoting", () => {
  assert.equal(unquotePath('"a \\"b\\".txt"'), 'a "b".txt');
  assert.equal(unquotePath("plain.txt"), "plain.txt");
});

test("localClock reads the author's own clock", () => {
  // 2024-03-05 was a Tuesday.
  assert.deepEqual(localClock("2024-03-05T23:14:02+05:00"), { hour: 23, weekday: 2 });
});

test("LogParser zips raw and numstat blocks per commit", () => {
  const p = new LogParser();
  const lines = [
    header("c2", "second | with pipe", undefined, "c1"),
    "",
    ":100644 100644 aaa bbb M\tsrc/a.ts",
    ":100644 000000 ccc 000 D\tsrc/old.ts",
    "",
    "4\t1\tsrc/a.ts",
    "0\t20\tsrc/old.ts",
    header("c1", "first"),
    "",
    ":000000 100644 000 aaa A\tsrc/a.ts",
    "",
    "10\t0\tsrc/a.ts",
  ];
  lines.forEach((l) => p.push(l));
  const commits = p.finish();
  assert.equal(commits.length, 2);
  assert.equal(commits[0].subject, "second | with pipe");
  assert.equal(commits[0].email, "ada@x.io");
  assert.deepEqual(commits[0].parents, ["c1"]);
  assert.deepEqual(commits[0].files[1], { path: "src/old.ts", status: "D", added: 0, deleted: 20 });
  assert.equal(commits[1].files[0].added, 10);
  assert.equal(commits[1].localHour, 23);
});

test("LogParser keeps merges with no file list", () => {
  const p = new LogParser();
  p.push(header("m1", "Merge branch 'x'", undefined, "a b"));
  const [m] = p.finish();
  assert.deepEqual(m.parents, ["a", "b"]);
  assert.deepEqual(m.files, []);
});
