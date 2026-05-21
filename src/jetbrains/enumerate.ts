import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { LocalExtension } from "../types.ts";
import { readPluginXml } from "./pluginxml.ts";

export function defaultJetbrainsPluginsRoot(): string {
  return join(homedir(), ".local", "share", "JetBrains");
}

export async function listJetbrainsPlugins(
  root = defaultJetbrainsPluginsRoot(),
): Promise<LocalExtension[]> {
  if (!existsSync(root)) return [];

  const ideDirs = readdirSync(root)
    .map((n) => join(root, n))
    .filter((p) => {
      try {
        return statSync(p).isDirectory();
      } catch {
        return false;
      }
    });

  const byId = new Map<string, LocalExtension>();

  for (const ideDir of ideDirs) {
    let pluginDirs: string[];
    try {
      pluginDirs = readdirSync(ideDir).map((n) => join(ideDir, n));
    } catch {
      continue;
    }
    for (const pluginDir of pluginDirs) {
      let stats;
      try {
        stats = statSync(pluginDir);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;

      const info = await readPluginXml(pluginDir);
      if (!info?.id) continue;

      const ext: LocalExtension = {
        source: "jetbrains",
        id: info.id,
        displayName: info.name,
        version: info.version ?? "",
        publisher: info.vendor,
        publisherDisplayName: info.vendor,
        description: info.description,
        homepage: info.vendorUrl,
        installPath: pluginDir,
      };

      const existing = byId.get(info.id);
      if (!existing || compareVersions(ext.version, existing.version) > 0) {
        byId.set(info.id, ext);
      }
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
