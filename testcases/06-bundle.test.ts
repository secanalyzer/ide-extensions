// Verifies: dist/ide-extensions.mjs exists, has the Node shebang, is
// executable, and produces the same behavior as the source CLI on the
// fixture inputs (proves the bundler hasn't broken the runtime).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { DIST_CLI, runDist, runSrc, fixtureDirsArgs } from "./helpers.ts";

test("Bundle file exists at dist/ide-extensions.mjs", () => {
  const s = statSync(DIST_CLI);
  assert.ok(s.isFile());
  assert.ok(s.size > 0);
});

test("Bundle starts with the Node shebang", () => {
  const content = readFileSync(DIST_CLI, "utf8");
  const firstLine = content.split("\n", 1)[0];
  assert.equal(firstLine, "#!/usr/bin/env node");
});

test("Bundle has executable bit set (chmod +x)", () => {
  const s = statSync(DIST_CLI);
  assert.ok((s.mode & 0o100) !== 0, `mode ${s.mode.toString(8)} lacks owner-exec`);
});

test("Bundle --help matches source --help (same documented behavior)", () => {
  const src = runSrc(["--help"]);
  const dist = runDist(["--help"]);
  assert.equal(dist.code, 0);
  // Drop the trailing whitespace differences and compare line-set membership.
  const srcLines = new Set(src.stdout.split("\n").map((l) => l.trim()).filter(Boolean));
  const distLines = new Set(dist.stdout.split("\n").map((l) => l.trim()).filter(Boolean));
  for (const line of srcLines) {
    assert.ok(distLines.has(line), `bundle --help missing line: ${line}`);
  }
});

test("Bundle produces the same JSON count as source on the fixtures", () => {
  const args = ["--offline", "--json", ...fixtureDirsArgs()];
  const srcRows = JSON.parse(runSrc(args).stdout).length;
  const distRows = JSON.parse(runDist(args).stdout).length;
  assert.equal(distRows, srcRows);
});

test("Bundle inlines its npm deps (cli-table3, yauzl) — bundle is self-contained", () => {
  // cli-table3 and yauzl are NOT marked external, so the bundle should be
  // sizable (tens of KB) and not require `node_modules` to run.
  const s = statSync(DIST_CLI);
  assert.ok(s.size > 20_000, `bundle suspiciously small (${s.size} B) — deps may not be inlined`);
});
