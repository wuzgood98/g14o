import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/metadata";

export const revalidate = false;

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: {
      allow: "/",
      userAgent: "*",
      disallow: "/api/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
