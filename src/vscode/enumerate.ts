import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { LocalExtension } from "../types.ts";

interface ExtensionsJsonEntry {
  identifier: { id: string };
  version: string;
  location?: { path?: string };
  relativeLocation?: string;
  metadata?: {
    publisherDisplayName?: string;
    installedTimestamp?: number;
  };
}

interface PackageJson {
  name?: string;
  displayName?: string;
  publisher?: string;
  version?: string;
  description?: string;
  homepage?: string;
  repository?: string | { url?: string };
  bugs?: string | { url?: string };
  __metadata?: { publisherDisplayName?: string };
}

export function defaultVscodeExtensionsDir(): string {
  return join(homedir(), ".vscode", "extensions");
}

export function defaultVscodeServerExtensionsDir(): string {
  return join(homedir(), ".vscode-server", "extensions");
}

export function listVscodeExtensions(
  dirs: string[] = [defaultVscodeExtensionsDir(), defaultVscodeServerExtensionsDir()],
): LocalExtension[] {
  const all: LocalExtension[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    all.push(...readOneDir(dir));
  }
  return dedupeByIdKeepHighest(all);
}

function readOneDir(extDir: string): LocalExtension[] {
  const indexPath = join(extDir, "extensions.json");
  if (existsSync(indexPath)) {
    try {
      const entries = JSON.parse(readFileSync(indexPath, "utf8")) as ExtensionsJsonEntry[];
      return entries
        .map((e) => fromIndexEntry(e, extDir))
        .filter((x): x is LocalExtension => !!x);
    } catch {
      // fall through to dir scan
    }
  }
  return scanDirectory(extDir);
}

function dedupeByIdKeepHighest(items: LocalExtension[]): LocalExtension[] {
  const byId = new Map<string, LocalExtension>();
  for (const item of items) {
    const key = item.id.toLowerCase();
    const existing = byId.get(key);
    if (!existing || compareVersions(item.version, existing.version) > 0) {
      byId.set(key, item);
    }
  }
  return Array.from(byId.values());
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-]/).map((p) => parseInt(p, 10) || 0);
  const pb = b.split(/[.\-]/).map((p) => parseInt(p, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function fromIndexEntry(entry: ExtensionsJsonEntry, extDir: string): LocalExtension | null {
  const id = entry.identifier?.id;
  if (!id) return null;
  const installPath = entry.location?.path ?? join(extDir, entry.relativeLocation ?? "");
  const pkg = readPackageJson(installPath);
  const [publisher] = id.split(".");
  return {
    source: "vscode",
    id,
    version: entry.version,
    publisher,
    publisherDisplayName: entry.metadata?.publisherDisplayName ?? pkg?.__metadata?.publisherDisplayName,
    displayName: pkg?.displayName,
    description: pkg?.description,
    repository: repoUrl(pkg?.repository),
    homepage: pkg?.homepage ?? repoUrl(pkg?.bugs),
    installPath,
  };
}

function scanDirectory(extDir: string): LocalExtension[] {
  const out: LocalExtension[] = [];
  for (const name of readdirSync(extDir)) {
    const full = join(extDir, name);
    if (!statSync(full).isDirectory()) continue;
    const pkg = readPackageJson(full);
    if (!pkg?.name || !pkg.publisher) continue;
    out.push({
      source: "vscode",
      id: `${pkg.publisher}.${pkg.name}`,
      version: pkg.version ?? "",
      publisher: pkg.publisher,
      publisherDisplayName: pkg.__metadata?.publisherDisplayName,
      displayName: pkg.displayName,
      description: pkg.description,
      repository: repoUrl(pkg.repository),
      homepage: pkg.homepage ?? repoUrl(pkg.bugs),
      installPath: full,
    });
  }
  return out;
}

function readPackageJson(dir: string): PackageJson | null {
  const p = join(dir, "package.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

function repoUrl(field: PackageJson["repository"] | PackageJson["bugs"]): string | undefined {
  if (!field) return undefined;
  if (typeof field === "string") return cleanGitUrl(field);
  return cleanGitUrl(field.url);
}

function cleanGitUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/^git\+/, "").replace(/\.git$/, "");
}
