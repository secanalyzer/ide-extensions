export function formatInstalls(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatRating(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

export function shortenUrl(url?: string, max = 50): string {
  if (!url) return "—";
  const cleaned = url.replace(/^https?:\/\//, "");
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}
