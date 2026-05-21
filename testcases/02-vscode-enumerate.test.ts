// Verifies: VS Code local enumeration reads extensions.json, dedupes by id
// keeping the highest version, and populates package.json-sourced fields.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSrc, fixtureDirsArgs } from "./helpers.ts";

interface VscodeRow {
  source: string;
  id: string;
  version: string;
  publisher?: string;
  publisherDisplayName?: string;
  displayName?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  installPath?: string;
}

function getRows(args: string[]): VscodeRow[] {
  const r = runSrc(["--offline", "--json", "--vscode-only", ...args]);
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  return JSON.parse(r.stdout) as VscodeRow[];
}

test("Fixture vscode-extensions enumerates 2 rows after dedupe", () => {
  // Fixture has 3 extensions.json entries but 2 unique ids (pubone.ext-a appears
  // at 1.0.0 and 1.1.0). Dedupe must keep 1.1.0.
  const rows = getRows(fixtureDirsArgs({ vscodeServer: null, jetbrains: null }));
  assert.equal(rows.length, 2);
  const ids = rows.map((r) => r.id).sort();
  assert.deepEqual(ids, ["pubone.ext-a", "pubtwo.ext-b"]);
});

test("Dedupe keeps the highest version of the same id", () => {
  const rows = getRows(fixtureDirsArgs({ vscodeServer: null, jetbrains: null }));
  const a = rows.find((r) => r.id === "pubone.ext-a");
  assert.ok(a, "pubone.ext-a present");
  assert.equal(a!.version, "1.1.0", "1.1.0 wins over 1.0.0");
});

test("Each row carries package.json-derived fields", () => {
  const rows = getRows(fixtureDirsArgs({ vscodeServer: null, jetbrains: null }));
  const a = rows.find((r) => r.id === "pubone.ext-a")!;
  assert.equal(a.publisher, "pubone");
  assert.equal(a.publisherDisplayName, "PubOne, Inc.");
  assert.equal(a.displayName, "Extension A");
  assert.equal(a.repository, "https://github.com/pubone/ext-a");
  assert.equal(a.homepage, "https://example.com/ext-a");
});

test("repository field accepts plain string form (PubTwo's package.json)", () => {
  const rows = getRows(fixtureDirsArgs({ vscodeServer: null, jetbrains: null }));
  const b = rows.find((r) => r.id === "pubtwo.ext-b")!;
  assert.equal(b.repository, "https://github.com/pubtwo/ext-b");
});

test("Pointing at a non-existent dir yields zero VS Code rows", () => {
  const rows = getRows(fixtureDirsArgs({ vscode: null, vscodeServer: null, jetbrains: null }));
  assert.equal(rows.length, 0);
});
