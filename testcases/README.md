# Test Cases

Uses Node's built-in test runner (`node:test`) under the `tsx` loader.

## Run all tests

```bash
npm test                            # offline tests only (fast, no network)
RUN_ONLINE_TESTS=1 npm test         # also runs the VS Code / JetBrains marketplace tests
```

The `pretest` hook rebuilds the bundle so `06-bundle.test.ts` always
exercises a freshly-produced artifact. Each test file is independent — you
can run one in isolation:

```bash
npx tsx --test testcases/02-vscode-enumerate.test.ts
```

## Host independence

Tests do **not** depend on the host machine having VS Code or any JetBrains
IDE installed. They use synthetic fixtures under `testcases/fixtures/` and
pin every CLI invocation to those fixtures with `--vscode-dir`,
`--vscode-server-dir`, and `--jetbrains-dir`. The same suite runs the same
way on a clean container, a developer laptop, or CI.

## What's covered

| File | Area | Network? |
|---|---|---|
| `01-cli-help.test.ts` | `--help` lists every documented flag; `-h` alias; default-path placeholders | offline |
| `02-vscode-enumerate.test.ts` | Reads `extensions.json`, dedupes by id keeping highest version, surfaces package.json fields (repository/homepage/publisher) | offline |
| `03-jetbrains-enumerate.test.ts` | Walks `<jetbrains-dir>/<IDE-ver>/<plugin>/META-INF/plugin.xml`, dedupes by xmlId across IDE-versions, unwraps CDATA descriptions | offline |
| `04-dedupe-and-merge.test.ts` | VS Code + VS Code-server merge: collisions resolved by version, server-only ids surface, install-path provenance preserved | offline |
| `05-output-formats.test.ts` | `--json` offline shape (no `remote`/`enrichmentError`), `--markdown` GitHub-flavored columns, default table summary line, `--vscode-only` / `--jetbrains-only` filters | offline |
| `06-bundle.test.ts` | `dist/ide-extensions.mjs` exists, shebang, `chmod +x`, source vs bundle `--help` parity, JSON-count parity, bundle size proves deps are inlined | offline |
| `07-vscode-marketplace.test.ts` | Live VS Code Marketplace: `ms-python.python` → official, `alefragnani.bookmarks` → individual, batched query, unknown-id graceful | **online** |
| `08-jetbrains-marketplace.test.ts` | Live JetBrains Marketplace: `org.intellij.scala` → official, per-plugin ratings differ (proves we're not returning the global ~4.08 prior), unknown-id graceful | **online** |

## Fixtures

```
fixtures/
├── vscode-extensions/                 # primary VS Code dir
│   ├── extensions.json                # 3 entries, 2 unique ids (one duplicated for dedupe)
│   ├── pubone.ext-a-1.0.0/package.json
│   ├── pubone.ext-a-1.1.0/package.json
│   └── pubtwo.ext-b-2.0.0/package.json
├── vscode-server-extensions/          # vscode-server dir for merge tests
│   ├── pubone.ext-a-1.2.0/package.json   # newer; wins merge collision
│   └── pubthree.remote-c-3.0.0/package.json   # unique to server dir
└── jetbrains-plugins/                 # ~/.local/share/JetBrains-shaped layout
    ├── IntelliJIdea2099.9/
    │   ├── plugin-aaa/META-INF/plugin.xml   # com.example.plugin-aaa v1.0.0
    │   └── plugin-bbb/META-INF/plugin.xml   # com.example.plugin-bbb v2.5.1
    └── PyCharm2099.9/
        └── plugin-aaa/META-INF/plugin.xml   # com.example.plugin-aaa v1.2.0 (newer; wins dedupe)
```

## Adding a new test

1. Create `NN-area.test.ts` (zero-padded prefix keeps the file listing tidy).
2. Import helpers from `./helpers.ts` (`runSrc`, `runDist`, `fixtureDirsArgs`,
   `isOnline`, `REPO_ROOT`, `FIXTURES`).
3. Use `node:test`'s `test()` and `node:assert/strict`.
4. For online tests, gate with `{ skip: !isOnline() }`.
5. Re-run `npm test`.
