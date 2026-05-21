import type { OriginType, RemoteMeta } from "../types.ts";

const SEARCH_ENDPOINT = "https://plugins.jetbrains.com/api/plugins";
const CONCURRENCY = 6;
const USER_AGENT = "ide-extensions/0.1";

interface SearchHit {
  id: number;
  xmlId: string;
}

interface PluginDetails {
  id: number;
  xmlId: string;
  name: string;
  link?: string;
  downloads?: number;
  vendor?: {
    type?: string;
    name?: string;
    publicName?: string;
    url?: string;
    isVerified?: boolean;
    isTrader?: boolean;
  };
  urls?: {
    url?: string;
    sourceCodeUrl?: string;
    bugtrackerUrl?: string;
  };
}

interface RatingResponse {
  votes?: Record<string, number>;
  meanRating?: number;
  meanVotes?: number;
}

export async function fetchJetbrainsMetadata(
  xmlIds: string[],
): Promise<Map<string, RemoteMeta>> {
  const out = new Map<string, RemoteMeta>();
  await runWithConcurrency(xmlIds, CONCURRENCY, async (xmlId) => {
    try {
      const meta = await lookupOne(xmlId);
      if (meta) out.set(xmlId.toLowerCase(), meta);
    } catch {
      // leave unset; cli will mark as enrichmentError
    }
  });
  return out;
}

async function lookupOne(xmlId: string): Promise<RemoteMeta | null> {
  const searchUrl = `${SEARCH_ENDPOINT}?xmlId=${encodeURIComponent(xmlId)}&family=intellij`;
  const searchRes = await fetch(searchUrl, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!searchRes.ok) return null;
  const hits = (await searchRes.json()) as SearchHit[] | SearchHit;
  const hit = Array.isArray(hits) ? hits[0] : hits;
  if (!hit?.id) return null;

  const [details, rating] = await Promise.all([
    fetch(`${SEARCH_ENDPOINT}/${hit.id}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    }).then((r) => (r.ok ? (r.json() as Promise<PluginDetails>) : null)),
    fetch(`${SEARCH_ENDPOINT}/${hit.id}/rating`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    }).then((r) => (r.ok ? (r.json() as Promise<RatingResponse>) : null)),
  ]);

  if (!details) return null;

  return {
    installs: details.downloads,
    rating: computeRating(rating),
    ratingCount: countVotes(rating?.votes),
    website:
      details.urls?.url ?? details.urls?.sourceCodeUrl ?? details.vendor?.url,
    origin: classifyJetbrains(details.vendor),
    publisherDisplayName: details.vendor?.publicName ?? details.vendor?.name,
    vendorType: details.vendor?.type,
    marketplaceUrl: details.link
      ? `https://plugins.jetbrains.com${details.link}`
      : `https://plugins.jetbrains.com/plugin/${details.id}`,
  };
}

function computeRating(rating: RatingResponse | null): number | undefined {
  // `meanRating` is the marketplace-wide Bayesian prior (≈4.08), not per-plugin.
  // The real per-plugin rating must be computed from the `votes` star distribution.
  const votes = rating?.votes;
  if (!votes) return undefined;
  let sum = 0;
  let count = 0;
  for (const [stars, n] of Object.entries(votes)) {
    const s = Number(stars);
    if (!Number.isFinite(s) || !Number.isFinite(n)) continue;
    sum += s * n;
    count += n;
  }
  if (count === 0) return undefined;
  return sum / count;
}

function countVotes(votes?: Record<string, number>): number | undefined {
  if (!votes) return undefined;
  let count = 0;
  for (const n of Object.values(votes)) {
    if (Number.isFinite(n)) count += n;
  }
  return count || undefined;
}

function classifyJetbrains(vendor: PluginDetails["vendor"]): OriginType {
  // JetBrains marks single-person publishers (e.g. Guy Mahieu / IvyIDEA) as
  // vendor.type === "organization" too, so type alone isn't reliable. Only
  // vendor.isVerified meaningfully separates trusted organizations from
  // individuals who happen to be registered as a vendor.
  if (!vendor) return "unknown";
  if (vendor.isVerified === true) return "official";
  return "individual";
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        await worker(items[i] as T);
      }
    },
  );
  await Promise.all(runners);
}
