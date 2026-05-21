import type { EnrichedExtension } from "../types.ts";

export function renderJson(items: EnrichedExtension[]): string {
  return JSON.stringify(items, null, 2);
}
