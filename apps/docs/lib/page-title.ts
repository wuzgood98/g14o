import type { source } from "@/lib/source";

export function formatPackageDisplayName(packageSlug: string): string {
  return packageSlug
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function getPageMetadataTitle(
  page: (typeof source)["$inferPage"]
): string {
  const [root, packageSlug] = page.slugs;
  if (root === "packages" && packageSlug) {
    return `${formatPackageDisplayName(packageSlug)} - ${page.data.title}`;
  }
  return page.data.title;
}
