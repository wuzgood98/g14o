import type { source } from "@/lib/source";

export async function getLLMText(page: (typeof source)["$inferPage"]) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title} (${page.url})
Source: https://github.com/wuzgood98/g14o/blob/main/apps/docs/content/docs/${page.path}

${page.data.description ?? ""}

${processed}`;
}
