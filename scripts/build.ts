#!/usr/bin/env bun
// Bundle the CLI into a single minified Node-runnable ESM file.
// Run with: bun run build
import { chmodSync, mkdirSync, rmSync } from "node:fs";

const OUTDIR = "dist";
const OUTFILE = `${OUTDIR}/ide-extensions.mjs`;

rmSync(OUTDIR, { recursive: true, force: true });
mkdirSync(OUTDIR, { recursive: true });

const result = await Bun.build({
  entrypoints: ["src/cli.ts"],
  outdir: OUTDIR,
  naming: "ide-extensions.mjs",
  target: "node",
  format: "esm",
  minify: true,
  banner: "#!/usr/bin/env node",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

chmodSync(OUTFILE, 0o755);

const size = (await Bun.file(OUTFILE).arrayBuffer()).byteLength;
console.log(`Built ${OUTFILE} (${(size / 1024).toFixed(1)} KB)`);
