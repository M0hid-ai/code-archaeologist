import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { safeJson, webDir } from "../src/render/site.js";

test("safeJson cannot break out of a script element", () => {
  const out = safeJson({ s: "</script><script>alert(1)</script>", amp: "a&b", ls: "x\u2028y" });
  assert.ok(!out.includes("</script"));
  assert.ok(!out.includes("<"));
  assert.ok(!out.includes("&"));
  assert.ok(!out.includes("\u2028"));
  assert.deepEqual(JSON.parse(out), { s: "</script><script>alert(1)</script>", amp: "a&b", ls: "x\u2028y" });
});

test("webDir finds the bundled front end", () => {
  const dir = webDir();
  assert.ok(existsSync(join(dir, "template.html")));
  assert.ok(existsSync(join(dir, "styles.css")));
  assert.ok(existsSync(join(dir, "js", "00-core.js")));
});
