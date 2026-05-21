import Table from "cli-table3";
import type { EnrichedExtension } from "../types.ts";
import { formatInstalls, formatRating, shortenUrl } from "./format.ts";

export function renderTable(items: EnrichedExtension[]): string {
  const table = new Table({
    head: ["Source", "ID", "Version", "Installs", "Rating", "Origin", "Website"],
    style: { head: ["cyan"], border: [] },
    colWidths: [10, 36, 12, 10, 8, 12, 52],
    wordWrap: true,
  });

  const sorted = [...items].sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return (b.remote?.installs ?? 0) - (a.remote?.installs ?? 0);
  });

  for (const item of sorted) {
    table.push([
      item.source,
      item.id,
      item.version || "—",
      formatInstalls(item.remote?.installs),
      formatRating(item.remote?.rating),
      item.remote?.origin ?? "unknown",
      shortenUrl(item.homepage ?? item.remote?.website ?? item.remote?.marketplaceUrl),
    ]);
  }

  const counts = summarize(items);
  return `${table.toString()}\n\n${counts}`;
}

function summarize(items: EnrichedExtension[]): string {
  const total = items.length;
  const bySource = new Map<string, number>();
  const byOrigin = new Map<string, number>();
  for (const i of items) {
    bySource.set(i.source, (bySource.get(i.source) ?? 0) + 1);
    const o = i.remote?.origin ?? "unknown";
    byOrigin.set(o, (byOrigin.get(o) ?? 0) + 1);
  }
  const src = [...bySource].map(([k, v]) => `${k}=${v}`).join(", ");
  const orig = [...byOrigin].map(([k, v]) => `${k}=${v}`).join(", ");
  return `Total: ${total}  [${src}]  origin: ${orig}`;
}
