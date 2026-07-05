import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/metadata";
import { source } from "@/lib/source";

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl();
  const url = (path: string) => new URL(path, base).toString();

  const pages = source.getPages().map((page) => ({
    url: url(page.url),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    { url: url("/"), changeFrequency: "monthly", priority: 1 },
    { url: url("/introduction"), changeFrequency: "weekly", priority: 0.9 },
    { url: url("/llms.txt"), changeFrequency: "weekly", priority: 0.9 },
    { url: url("/llms-full.txt"), changeFrequency: "weekly", priority: 0.8 },
    ...pages,
  ];
}
