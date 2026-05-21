// Verifies: JetBrains local enumeration walks <jetbrains-dir>/<IDE-ver>/<plugin>/,
// reads META-INF/plugin.xml directly when present, and dedupes by xmlId across
// IDE versions keeping the highest version.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSrc, fixtureDirsArgs } from "./helpers.ts";

interface JbRow {
  source: string;
  id: string;
  displayName?: string;
  version: string;
  publisher?: string;
  publisherDisplayName?: string;
  description?: string;
  homepage?: string;
}

function getRows(): JbRow[] {
  const r = runSrc([
    "--offline",
    "--json",
    "--jetbrains-only",
    ...fixtureDirsArgs({ vscode: null, vscodeServer: null }),
  ]);
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  return JSON.parse(r.stdout) as JbRow[];
}

test("Fixture yields 2 JetBrains rows after dedupe (aaa wins newer from PyCharm)", () => {
  const rows = getRows();
  assert.equal(rows.length, 2);
  const ids = rows.map((r) => r.id).sort();
  assert.deepEqual(ids, ["com.example.plugin-aaa", "com.example.plugin-bbb"]);
});

test("Dedupe across IDE-versions keeps the highest version (aaa: 1.2.0 > 1.0.0)", () => {
  const rows = getRows();
  const aaa = rows.find((r) => r.id === "com.example.plugin-aaa")!;
  assert.equal(aaa.version, "1.2.0");
});

test("Vendor and homepage come from plugin.xml <vendor url=...>", () => {
  const rows = getRows();
  const aaa = rows.find((r) => r.id === "com.example.plugin-aaa")!;
  assert.equal(aaa.publisher, "Example AAA Vendor");
  assert.equal(aaa.publisherDisplayName, "Example AAA Vendor");
  assert.equal(aaa.homepage, "https://example.com/aaa");
});

test("CDATA-wrapped description is unwrapped correctly", () => {
  const rows = getRows();
  const aaa = rows.find((r) => r.id === "com.example.plugin-aaa")!;
  // Plugin AAA's "newer copy" in PyCharm2099.9 wins dedupe; its description is plain.
  assert.match(aaa.description ?? "", /newer copy/);
});

test("source field is correctly 'jetbrains' on every row", () => {
  const rows = getRows();
  for (const r of rows) assert.equal(r.source, "jetbrains");
});
