// Verifies: VS Code + VS Code-server merge — both dirs feed the same dedupe
// pipeline. A higher version in the server dir wins over the local dir; ids
// unique to either dir surface in the merged result.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSrc, fixtureDirsArgs } from "./helpers.ts";

function getRows(): Array<{ id: string; version: string; installPath?: string }> {
  const r = runSrc([
    "--offline",
    "--json",
    "--vscode-only",
    ...fixtureDirsArgs({ jetbrains: null }), // include both vscode + vscode-server fixtures
  ]);
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

test("Merged vscode + vscode-server fixtures yield 3 ids", () => {
  const rows = getRows();
  const ids = rows.map((r) => r.id).sort();
  assert.deepEqual(ids, ["pubone.ext-a", "pubthree.remote-c", "pubtwo.ext-b"]);
});

test("Server-dir version (1.2.0) wins over local-dir version (1.1.0)", () => {
  const rows = getRows();
  const a = rows.find((r) => r.id === "pubone.ext-a")!;
  assert.equal(a.version, "1.2.0");
  assert.match(a.installPath ?? "", /vscode-server-extensions/);
});

test("Local-only id (pubtwo.ext-b) keeps its local installPath", () => {
  const rows = getRows();
  const b = rows.find((r) => r.id === "pubtwo.ext-b")!;
  assert.equal(b.version, "2.0.0");
  assert.match(b.installPath ?? "", /vscode-extensions\/pubtwo\.ext-b/);
});

test("Server-only id (pubthree.remote-c) surfaces from server dir", () => {
  const rows = getRows();
  const c = rows.find((r) => r.id === "pubthree.remote-c")!;
  assert.equal(c.version, "3.0.0");
  assert.match(c.installPath ?? "", /vscode-server-extensions/);
});

test("Skipping vscode-server reduces count to 2 (no merge)", () => {
  const r = runSrc([
    "--offline",
    "--json",
    "--vscode-only",
    ...fixtureDirsArgs({ vscodeServer: null, jetbrains: null }),
  ]);
  const rows = JSON.parse(r.stdout) as Array<{ id: string }>;
  assert.equal(rows.length, 2);
});
