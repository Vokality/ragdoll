import type { SourceCitation } from "../electron-api.js";

export interface WebSearchResult {
  text: string;
  sources: SourceCitation[];
}
export interface WebSearchService {
  search(query: string, signal?: AbortSignal): Promise<WebSearchResult>;
}
