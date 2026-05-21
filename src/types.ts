export type Source = "vscode" | "jetbrains";

export type OriginType = "official" | "individual" | "unknown";

export interface LocalExtension {
  source: Source;
  id: string;
  displayName?: string;
  version: string;
  publisher?: string;
  publisherDisplayName?: string;
  description?: string;
  repository?: string;
  homepage?: string;
  installPath?: string;
}

export interface RemoteMeta {
  installs?: number;
  rating?: number;
  ratingCount?: number;
  website?: string;
  origin: OriginType;
  publisherDisplayName?: string;
  publisherDomain?: string;
  vendorType?: string;
  marketplaceUrl?: string;
}

export interface EnrichedExtension extends LocalExtension {
  remote?: RemoteMeta;
  enrichmentError?: string;
}
