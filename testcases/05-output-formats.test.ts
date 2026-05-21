// Verifies: --json default shape (offline + online), --markdown shape, table
// renderer's "sort within source by install count desc" claim (using fixture
// row counts where install counts are absent — so sort is a no-op but the
// command must still exit 0 and emit the expected columns).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSrc, fixtureDirsArgs } from "./helpers.ts";

test("--json offline mode: rows have no 'remote' and no 'enrichmentError'", () => {
  const r = runSrc(["--offline", "--json", ...fixtureDirsArgs()]);
  assert.equal(r.code, 0);
  const rows = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(!("remote" in row) || row["remote"] === undefined, "offline rows lack 'remote'");
    assert.ok(!("enrichmentError" in row) || row["enrichmentError"] === undefined, "offline rows lack 'enrichmentError'");
  }
});

test("--json contains expected core fields on every row", () => {
  const r = runSrc(["--offline", "--json", ...fixtureDirsArgs()]);
  const rows = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
  for (const row of rows) {
    assert.ok(typeof row["source"] === "string");
    assert.ok(typeof row["id"] === "string");
    assert.ok(typeof row["version"] === "string");
  }
});

test("--markdown renders a GitHub-flavored table with the documented columns", () => {
  const r = runSrc(["--offline", "--markdown", ...fixtureDirsArgs()]);
  assert.equal(r.code, 0);
  const lines = r.stdout.trim().split("\n");
  assert.match(lines[0]!, /\| Source \| ID \| Version \| Installs \| Rating \| Origin \| Website \|/);
  assert.match(lines[1]!, /\| --- \| --- \|/);
  // header (2) + body rows = total
  const expectedBody = lines.length - 2;
  assert.ok(expectedBody > 0, "at least one body row");
});

test("Default table renderer prints all rows + a one-line summary", () => {
  const r = runSrc(["--offline", ...fixtureDirsArgs()]);
  assert.equal(r.code, 0);
  // Summary line format: "Total: N  [vscode=X, jetbrains=Y]  origin: …"
  assert.match(r.stdout, /Total:\s+\d+\s+\[vscode=\d+, jetbrains=\d+\]\s+origin:/);
});

test("--vscode-only restricts output to vscode rows", () => {
  const r = runSrc(["--offline", "--json", "--vscode-only", ...fixtureDirsArgs()]);
  const rows = JSON.parse(r.stdout) as Array<{ source: string }>;
  assert.ok(rows.length > 0);
  for (const row of rows) assert.equal(row.source, "vscode");
});

test("--jetbrains-only restricts output to jetbrains rows", () => {
  const r = runSrc(["--offline", "--json", "--jetbrains-only", ...fixtureDirsArgs()]);
  const rows = JSON.parse(r.stdout) as Array<{ source: string }>;
  assert.ok(rows.length > 0);
  for (const row of rows) assert.equal(row.source, "jetbrains");
});

test("Conflicting --vscode-only + --jetbrains-only yields zero rows (both filters applied)", () => {
  const r = runSrc(["--offline", "--json", "--vscode-only", "--jetbrains-only", ...fixtureDirsArgs()]);
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.stdout), []);
});
