import type { EnrichedExtension } from "../types.ts";
import { formatInstalls, formatRating } from "./format.ts";

export function renderMarkdown(items: EnrichedExtension[]): string {
  const sorted = [...items].sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return (b.remote?.installs ?? 0) - (a.remote?.installs ?? 0);
  });

  const lines = [
    "| Source | ID | Version | Installs | Rating | Origin | Website |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const i of sorted) {
    const url = i.homepage ?? i.remote?.website ?? i.remote?.marketplaceUrl ?? "";
    const website = url ? `[link](${url})` : "—";
    lines.push(
      `| ${i.source} | \`${i.id}\` | ${i.version || "—"} | ${formatInstalls(i.remote?.installs)} | ${formatRating(i.remote?.rating)} | ${i.remote?.origin ?? "unknown"} | ${website} |`,
    );
  }
  return lines.join("\n");
}
