import type { OriginType, RemoteMeta } from "../types.ts";

const ENDPOINT =
  "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1";

const FLAGS = 914;
const BATCH_SIZE = 50;

const STAT_INSTALL = "install";
const STAT_AVG_RATING = "averagerating";
const STAT_WEIGHTED_RATING = "weightedRating";
const STAT_RATING_COUNT = "ratingcount";

interface ApiPublisher {
  publisherName: string;
  displayName?: string;
  flags?: string;
  domain?: string;
  isDomainVerified?: boolean;
}

interface ApiStatistic {
  statisticName: string;
  value: number;
}

interface ApiVersionProperty {
  key: string;
  value: string;
}

interface ApiVersion {
  version: string;
  properties?: ApiVersionProperty[];
}

interface ApiExtension {
  extensionName: string;
  publisher: ApiPublisher;
  statistics?: ApiStatistic[];
  versions?: ApiVersion[];
}

interface ApiResponse {
  results: Array<{ extensions?: ApiExtension[] }>;
}

export async function fetchVscodeMetadata(
  ids: string[],
): Promise<Map<string, RemoteMeta>> {
  const result = new Map<string, RemoteMeta>();
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const exts = await queryBatch(batch);
    for (const ext of exts) {
      const fullId = `${ext.publisher.publisherName}.${ext.extensionName}`;
      result.set(fullId.toLowerCase(), toRemoteMeta(ext));
    }
  }
  return result;
}

async function queryBatch(ids: string[]): Promise<ApiExtension[]> {
  const body = {
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          ...ids.map((value) => ({ filterType: 7, value })),
        ],
        pageSize: ids.length,
        pageNumber: 1,
      },
    ],
    flags: FLAGS,
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json;api-version=3.0-preview.1",
      "Content-Type": "application/json",
      "User-Agent": "ide-extensions/0.1",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`VS Code marketplace HTTP ${res.status}`);
  }

  const json = (await res.json()) as ApiResponse;
  return json.results[0]?.extensions ?? [];
}

function toRemoteMeta(ext: ApiExtension): RemoteMeta {
  const stats = new Map(
    (ext.statistics ?? []).map((s) => [s.statisticName, s.value]),
  );
  const props = new Map(
    (ext.versions?.[0]?.properties ?? []).map((p) => [p.key, p.value]),
  );

  return {
    installs: stats.get(STAT_INSTALL),
    rating: stats.get(STAT_WEIGHTED_RATING) ?? stats.get(STAT_AVG_RATING),
    ratingCount: stats.get(STAT_RATING_COUNT),
    website: pickWebsite(props),
    origin: classifyVscode(ext.publisher),
    publisherDisplayName: ext.publisher.displayName,
    publisherDomain: ext.publisher.domain,
    marketplaceUrl: `https://marketplace.visualstudio.com/items?itemName=${ext.publisher.publisherName}.${ext.extensionName}`,
  };
}

function pickWebsite(props: Map<string, string>): string | undefined {
  const keys = [
    "Microsoft.VisualStudio.Services.Links.Source",
    "Microsoft.VisualStudio.Services.Links.GitHub",
    "Microsoft.VisualStudio.Services.Links.Learn",
    "Microsoft.VisualStudio.Services.Links.Support",
    "Microsoft.VisualStudio.Services.Links.Getstarted",
  ];
  for (const k of keys) {
    const v = props.get(k);
    if (v) return v.replace(/\.git$/, "");
  }
  return undefined;
}

function classifyVscode(publisher: ApiPublisher): OriginType {
  // VS Code Marketplace uses domain verification as the "is this a real organization"
  // signal. publisher.flags includes "verified" for nearly every publisher (it just
  // means email-verified), so it is not a reliable official-vs-individual signal.
  if (publisher.isDomainVerified === true) return "official";
  return "individual";
}
