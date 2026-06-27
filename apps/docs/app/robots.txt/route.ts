import { getBaseUrl } from "@/lib/metadata";

export const revalidate = false;

export function GET() {
  const base = getBaseUrl();
  const body = [
    "# g14o documentation",
    `# llms.txt: ${base}/llms.txt`,
    `# llms-full.txt: ${base}/llms-full.txt`,
    "",
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${base}/sitemap.xml`,
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
