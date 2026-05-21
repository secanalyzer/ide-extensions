// Shared helpers for the testcases/ suite. Resolves repo paths and shells out
// to the CLI in source form (via tsx) or the bundled form (dist/).
//
// spawnSync is used (not execFileSync) because we need to capture stderr
// regardless of exit code, and want a uniform success/failure surface.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = dirname(HERE);
export const FIXTURES = join(HERE, "fixtures");

export const TSX_BIN = join(REPO_ROOT, "node_modules", ".bin", "tsx");
export const SRC_CLI = join(REPO_ROOT, "src", "cli.ts");
export const DIST_CLI = join(REPO_ROOT, "dist", "ide-extensions.mjs");

export const FIXTURE_VSCODE = join(FIXTURES, "vscode-extensions");
export const FIXTURE_VSCODE_SERVER = join(FIXTURES, "vscode-server-extensions");
export const FIXTURE_JETBRAINS = join(FIXTURES, "jetbrains-plugins");

// A path that's guaranteed not to exist — used to neutralize the default
// vscode / vscode-server / jetbrains dir when a test only wants one source.
export const NOWHERE = "/tmp/__ide_extensions_nowhere__";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface RunOpts {
  stdin?: string;
  env?: NodeJS.ProcessEnv;
}

function run(cmd: string, argv: string[], opts: RunOpts): RunResult {
  const r = spawnSync(cmd, argv, {
    input: opts.stdin,
    encoding: "utf8",
    cwd: REPO_ROOT,
    env: { ...process.env, ...(opts.env ?? {}) },
    maxBuffer: 50 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// Run CLI in source form (`npx tsx src/cli.ts ...`).
export function runSrc(args: string[], opts: RunOpts = {}): RunResult {
  return run(TSX_BIN, [SRC_CLI, ...args], opts);
}

// Run CLI in bundled form (`node dist/ide-extensions.mjs ...`).
export function runDist(args: string[], opts: RunOpts = {}): RunResult {
  if (!existsSync(DIST_CLI)) {
    throw new Error(`dist not built: ${DIST_CLI} missing — pretest should run 'npm run build'`);
  }
  return run(process.execPath, [DIST_CLI, ...args], opts);
}

// Convenience: build the argv slice that pins all three dirs to fixtures
// (so the host's own installs never leak into a test).
export function fixtureDirsArgs(opts: {
  vscode?: string | null;
  vscodeServer?: string | null;
  jetbrains?: string | null;
} = {}): string[] {
  const v = opts.vscode === undefined ? FIXTURE_VSCODE : (opts.vscode ?? NOWHERE);
  const s = opts.vscodeServer === undefined ? FIXTURE_VSCODE_SERVER : (opts.vscodeServer ?? NOWHERE);
  const j = opts.jetbrains === undefined ? FIXTURE_JETBRAINS : (opts.jetbrains ?? NOWHERE);
  return [
    "--vscode-dir", v,
    "--vscode-server-dir", s,
    "--jetbrains-dir", j,
  ];
}

export function isOnline(): boolean {
  return process.env["RUN_ONLINE_TESTS"] === "1" || process.env["RUN_ONLINE_TESTS"] === "true";
}
