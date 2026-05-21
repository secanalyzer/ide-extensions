import { parseArgs } from "node:util";
import {
  listVscodeExtensions,
  defaultVscodeExtensionsDir,
  defaultVscodeServerExtensionsDir,
} from "./vscode/enumerate.ts";
import {
  listJetbrainsPlugins,
  defaultJetbrainsPluginsRoot,
} from "./jetbrains/enumerate.ts";
import { enrich } from "./enrich.ts";
import { renderTable } from "./render/table.ts";
import { renderMarkdown } from "./render/markdown.ts";
import { renderJson } from "./render/json.ts";
import type { EnrichedExtension, LocalExtension } from "./types.ts";

const HELP = `Usage: ide-extensions [options]

Lists installed VS Code extensions and JetBrains plugins with marketplace metadata.

Options:
  --json                Emit JSON instead of a table.
  --markdown            Emit a GitHub-flavored markdown table.
  --vscode-only         Skip JetBrains plugins.
  --jetbrains-only      Skip VS Code extensions.
  --offline             Skip marketplace enrichment (local data only).
  --vscode-dir <path>   Override VS Code extensions dir.
                        Default: ${defaultVscodeExtensionsDir()}
  --vscode-server-dir <path>
                        Override VS Code remote-server extensions dir.
                        Default: ${defaultVscodeServerExtensionsDir()}
  --jetbrains-dir <path>
                        Override JetBrains plugins root.
                        Default: ${defaultJetbrainsPluginsRoot()}
  -h, --help            Show this help.
`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      json: { type: "boolean" },
      markdown: { type: "boolean" },
      "vscode-only": { type: "boolean" },
      "jetbrains-only": { type: "boolean" },
      offline: { type: "boolean" },
      "vscode-dir": { type: "string" },
      "vscode-server-dir": { type: "string" },
      "jetbrains-dir": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const wantVscode = !values["jetbrains-only"];
  const wantJetbrains = !values["vscode-only"];

  const local: LocalExtension[] = [];
  if (wantVscode) {
    const dirs = [
      values["vscode-dir"] ?? defaultVscodeExtensionsDir(),
      values["vscode-server-dir"] ?? defaultVscodeServerExtensionsDir(),
    ];
    local.push(...listVscodeExtensions(dirs));
  }
  if (wantJetbrains) {
    local.push(...(await listJetbrainsPlugins(values["jetbrains-dir"])));
  }

  let items: EnrichedExtension[];
  if (values.offline) {
    items = local.map((e) => ({ ...e }));
  } else {
    items = await enrich(local);
  }

  if (values.json) {
    process.stdout.write(renderJson(items) + "\n");
  } else if (values.markdown) {
    process.stdout.write(renderMarkdown(items) + "\n");
  } else {
    process.stdout.write(renderTable(items) + "\n");
  }
  return 0;
}

main().then(
  (code) => {
    // Avoid process.exit on success: it can truncate piped stdout because
    // process.stdout.write is non-blocking on pipes. Setting exitCode lets
    // Node flush stdout naturally before exiting.
    process.exitCode = code;
  },
  (err) => {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exitCode = 1;
  },
);
