import type { SortedResult } from "fumadocs-core/search";
import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

const searchApi = createFromSource(source, {
  language: "english",
});

export function searchDocs(query: string, limit = 10): Promise<SortedResult[]> {
  return searchApi.search(query, { limit });
}

export function handleSearch(request: Request) {
  return searchApi.GET(request);
}
