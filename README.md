# Find IDE Extensions

A standalone CLI that lists every IDE extension/plugin you have installed
locally — across **VS Code** and **JetBrains IntelliJ-family IDEs** — and
enriches each entry with marketplace metadata: **rating**, **install/download
count**, **website**, and **origin type** (verified organization vs. individual) for credibility auditing.

No IDE has to be running. Works offline (local-only) with install counts and rating or online with those data.

## Quick start

```bash
npm install
npx tsx src/cli.ts
```

## Build and distribution

Bundle into a single minified ESM file (~69 KB, all npm deps inlined, Node-runnable):

```bash
npm run build         # writes dist/ide-extensions.mjs
```

The build script lives in `scripts/build.ts` and uses Bun's bundler API
(`target: "node"`, `minify: true`, ESM output with a `#!/usr/bin/env node`
banner so the artifact is directly executable):

```bash
./dist/ide-extensions.mjs --help        # direct (chmod +x set by the build)
node dist/ide-extensions.mjs --help     # or via node
```

Distribution paths:

- **npm publish** — `package.json` declares `bin.ide-extensions` →
  `dist/ide-extensions.mjs` and `files: ["dist/", "README.md"]`, so an
  install picks up only the bundle. `prepublishOnly` runs the build before
  publishing.
- **Direct artifact** — ship `dist/ide-extensions.mjs` to any Node ≥ 20 host;
  no `node_modules` required.

Requires Bun installed (`curl -fsSL https://bun.sh/install | bash`) only at
build time. End users run the bundle on Node.

## Usage

```
ide-extensions [options]

  --json                Emit JSON instead of a table.
  --markdown            Emit a GitHub-flavored markdown table.
  --vscode-only         Skip JetBrains plugins.
  --jetbrains-only      Skip VS Code extensions.
  --offline             Skip marketplace enrichment (local data only).
  --vscode-dir <path>   Override VS Code extensions dir.
  --vscode-server-dir <path>
                        Override VS Code remote-server extensions dir.
  --jetbrains-dir <path>
                        Override JetBrains plugins root.
  -h, --help            Show help.
```

### Examples

```bash
# Default: human-readable table
npx tsx src/cli.ts

# JSON for scripting
npx tsx src/cli.ts --json | jq '[.[] | select(.remote.origin == "individual")]'

# Markdown table to paste into a README or wiki
npx tsx src/cli.ts --markdown > extensions.md

# Local-only, no network
npx tsx src/cli.ts --offline

# Just one ecosystem
npx tsx src/cli.ts --vscode-only
npx tsx src/cli.ts --jetbrains-only
```

## Output formats

### Table (default)

`cli-table3` with columns `Source · ID · Version · Installs · Rating · Origin
· Website`. Sorted within each source by install count descending. Ends with a
one-line summary of totals by source and origin.

### `--json`

Raw `EnrichedExtension[]` array. Online, each item has a `remote` sub-object
(or `enrichmentError: "no marketplace match"` if the marketplace lookup
returned nothing). With `--offline`, items have neither field — only the
locally-discoverable fields are populated. Stable shape for scripting.

### `--markdown`

A GitHub-flavored markdown table. Same columns as the default table, with the
website wrapped as a `[link](url)` reference.

## Data and Statistics

### Data Sources

#### VS Code

- **Local:** the index `~/.vscode/extensions/extensions.json` VS Code
  maintains for installed extensions, plus the equivalent index under
  `~/.vscode-server/extensions/` for any remote-server installs. Both locations are merged and deduplicated by id,
  keeping the highest version (override either via `--vscode-dir` /
  `--vscode-server-dir`). Falls back to scanning the directory if the index
  is missing. Per-extension `package.json` supplies repository and homepage
  links.
- **Remote:** [POST](https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery)
  with flag `914` and `filterType: 7` (exact `publisher.name`), batched 50 ids
  per request. Returns publisher flags, statistics (`install`, `weightedRating`,
  `averagerating`, `ratingcount`), and version properties (source/GitHub/learn
  links).

#### JetBrains

- **Local:** `~/.local/share/JetBrains/<IDE><version>/<plugin>/`. Each
  plugin's `META-INF/plugin.xml` is read directly or extracted from a jar in
  `lib/` via `yauzl`. We extract `<id>`, `<name>`, `<version>`, `<vendor>` and
  the vendor `url`/`email` attributes. Deduplicated by xmlId across IDE
  versions, keeping the highest version. Bundled plugins shipped inside the IDE
  install directory are intentionally skipped because they are considered trustworthy.
- **Remote:** [GET](https://plugins.jetbrains.com/api/plugins?xmlId=<id>&family=intellij)
  to map xmlId → numeric plugin id, then `/api/plugins/<id>` for details and
  `/api/plugins/<id>/rating` for the votes histogram.

### How origin type is decided

Both marketplaces have ambiguous signals; the two rules below are the ones
empirically reliable, not the rules a casual reading of the API docs would
suggest.

#### VS Code

**`isDomainVerified === true`**

`publisher.flags` literally contains `"verified"` for **almost every
publisher** — it's effectively an email-confirmed flag, not an
official-organization flag. The actual official-vs-individual signal is
`publisher.isDomainVerified === true`, which requires the publisher to prove
ownership of an eligible domain at least six months old.

```ts
// src/vscode/marketplace.ts
if (publisher.isDomainVerified === true) return "official";
return "individual";
```

#### JetBrains
**`vendor.isVerified === true`**

`vendor.type === "organization"` is **not reliable** — single-person publishers
are also registered as `"organization"`. Only
`vendor.isVerified === true` separates JetBrains-verified vendors from the
rest.

```ts
// src/jetbrains/marketplace.ts
if (vendor.isVerified === true) return "official";
return "individual";
```

### How JetBrains rating is computed

`/api/plugins/<id>/rating` returns a `meanRating` field that looks per-plugin
but is actually a **marketplace-wide Bayesian prior** (~4.08 for every
plugin). The real per-plugin rating must be computed from the `votes` star
distribution:

```
rating = Σ (stars × count) / Σ count
```

See `computeRating` in `src/jetbrains/marketplace.ts`.

## Code structure

```
ide-extensions/
├── package.json
├── tsconfig.json
├── scripts/
│   └── build.ts                # bun bundler entry: minified ESM → dist/
├── src/
│   ├── cli.ts                  # parseArgs entry point, flag dispatch
│   ├── types.ts                # LocalExtension, RemoteMeta, EnrichedExtension, OriginType
│   ├── enrich.ts               # joins local + remote per source
│   ├── vscode/
│   │   ├── enumerate.ts        # reads ~/.vscode/extensions/extensions.json
│   │   └── marketplace.ts      # batched POST to extensionquery
│   ├── jetbrains/
│   │   ├── enumerate.ts        # walks ~/.local/share/JetBrains/
│   │   ├── pluginxml.ts        # plugin.xml reader (direct + jar via yauzl)
│   │   └── marketplace.ts      # plugins.jetbrains.com API client
│   └── render/
│       ├── format.ts           # number/url formatting helpers
│       ├── table.ts            # default cli-table3 output
│       ├── markdown.ts         # GitHub-flavored markdown table
│       └── json.ts             # raw JSON dump
└── README.md
```

### Dependencies

- `cli-table3` — table rendering
- `yauzl` — streaming zip reader (for `plugin.xml` inside jars)
- `tsx` + `typescript` (dev) — run TS directly without a build step

HTTP uses the built-in `fetch` in Node ≥ 20. Argument parsing uses the
built-in `node:util` `parseArgs`. No `axios`, no `commander`.

## License

MIT
