import type { EnrichedExtension, LocalExtension, RemoteMeta } from "./types.ts";
import { fetchVscodeMetadata } from "./vscode/marketplace.ts";
import { fetchJetbrainsMetadata } from "./jetbrains/marketplace.ts";

export async function enrich(extensions: LocalExtension[]): Promise<EnrichedExtension[]> {
  const vscodeIds = extensions.filter((e) => e.source === "vscode").map((e) => e.id);
  const jetbrainsIds = extensions.filter((e) => e.source === "jetbrains").map((e) => e.id);

  const [vscodeMap, jetbrainsMap] = await Promise.all([
    vscodeIds.length ? fetchVscodeMetadata(vscodeIds).catch(asEmpty) : asEmpty(),
    jetbrainsIds.length ? fetchJetbrainsMetadata(jetbrainsIds).catch(asEmpty) : asEmpty(),
  ]);

  return extensions.map((e) => {
    const map = e.source === "vscode" ? vscodeMap : jetbrainsMap;
    const remote = map.get(e.id.toLowerCase());
    return {
      ...e,
      remote,
      enrichmentError: remote ? undefined : "no marketplace match",
      homepage: e.homepage ?? remote?.website,
    };
  });
}

function asEmpty(): Map<string, RemoteMeta> {
  return new Map();
}
