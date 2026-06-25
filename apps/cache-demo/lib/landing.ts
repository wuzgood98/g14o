import type { Result } from "@g14o/cache/types";
import { withCache } from "@/lib/cache";

const FETCH_DELAY_MS = 50;

export interface LandingCategory {
  id: string;
  name: string;
}

export interface LandingFeatured {
  id: string;
  title: string;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchCategories(): Promise<Result<LandingCategory[], Error>> {
  await delay(FETCH_DELAY_MS);
  return {
    ok: true,
    data: [
      { id: "1", name: "Bedding" },
      { id: "2", name: "Decor" },
      { id: "3", name: "Kitchen" },
    ],
  };
}

async function fetchFeatured(): Promise<Result<LandingFeatured[], Error>> {
  await delay(FETCH_DELAY_MS);
  return {
    ok: true,
    data: [
      { id: "a", title: "Cozy Throw Blanket" },
      { id: "b", title: "Ceramic Mug Set" },
    ],
  };
}

export const getCategoriesCached = withCache(fetchCategories, {
  prefix: "landing",
  keyGenerator: () => "categories",
  ttl: "long",
});

export const getFeaturedCached = withCache(fetchFeatured, {
  prefix: "landing",
  keyGenerator: () => "featured",
  ttl: "long",
});
