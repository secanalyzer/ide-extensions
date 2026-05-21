// Verifies: --help renders the documented flag set, both via source CLI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSrc } from "./helpers.ts";

const REQUIRED_FLAGS = [
  "--json",
  "--markdown",
  "--vscode-only",
  "--jetbrains-only",
  "--offline",
  "--vscode-dir",
  "--vscode-server-dir",
  "--jetbrains-dir",
  "--help",
];

test("--help exits 0 and lists every documented flag", () => {
  const r = runSrc(["--help"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Usage: ide-extensions \[options\]/);
  for (const flag of REQUIRED_FLAGS) {
    assert.ok(r.stdout.includes(flag), `help missing ${flag}`);
  }
});

test("--help shows the default vscode-dir, vscode-server-dir, jetbrains-dir paths", () => {
  const r = runSrc(["--help"]);
  // Defaults come from os.homedir(), so we don't assert specific values —
  // just that the placeholder text "Default:" appears under each path flag.
  assert.match(r.stdout, /vscode-dir[\s\S]+Default:/);
  assert.match(r.stdout, /vscode-server-dir[\s\S]+Default:/);
  assert.match(r.stdout, /jetbrains-dir[\s\S]+Default:/);
});

test("-h works as a short alias for --help", () => {
  const r = runSrc(["-h"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Usage: ide-extensions/);
});
