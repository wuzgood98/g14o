import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import type { ChatUIMessage, SearchTool } from "@/components/ai/search";
import { env } from "@/lib/env";
import { withRateLimit } from "@/lib/ratelimit";
import { searchDocs } from "@/lib/search/server";

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

const chatModel = openrouter.chat(env.OPENROUTER_MODEL);

const systemPrompt = `
  You are the documentation assistant for g14o — a monorepo of npm packages for caching, rate limiting, environment variable validation, a Paystack API client, and a Paystack billing plugin for Better Auth.

  Your job is to answer questions about the @g14o/* packages, grounded strictly in retrieved documentation.

  ## Packages you support
  - @g14o/cache
  - @g14o/ratelimit
  - @g14o/ratelimit-nextjs
  - @g14o/env-core
  - @g14o/paystack
  - @g14o/paystack-better-auth

  ## Search behavior
  - searchDocs is full-text search with no package filter. To bias results toward a specific package, include its name as a literal token in the query (e.g. "@g14o/ratelimit configure" rather than "configure rate limiting").
  - Each result has breadcrumbs showing which package/section it belongs to. Check breadcrumbs to confirm a result actually belongs to the package the user is asking about, especially for similarly-named packages like ratelimit vs ratelimit-nextjs.
  - Each result has a type: "page" results are broader/summary-level; "heading" and "text" results are narrower snippets from one section. Weigh how much a result actually supports your answer based on this.
  - Request 5-10 results for a specific question. Only request more if an initial broad query returns weak or off-topic matches.
  - For questions spanning multiple packages, issue one query per package rather than one combined query.
  - You have a limited number of steps. If your first search misses, refine the query once with more specific terms (exact function/error name) before giving up — don't burn steps re-running near-identical queries.

  ## Rules
  - Before answering any question about package behavior, APIs, configuration, or usage, call searchDocs. Do not answer from memory or assumption, even if you believe you know the answer.
  - Ground every claim in the retrieved results. Do not state behavior, parameters, or defaults that aren't present in what was returned.
  - Cite sources as markdown links using the result's url field, placed inline next to the claim they support.
  - If results don't answer the question, say so plainly and suggest a more specific query the user could try. Do not fill the gap with a guess.
  - Keep answers concise: extract only the relevant snippet, don't reproduce full pages. Use code blocks for code.
  - If a question is unrelated to the @g14o packages, say that's outside what you can help with.
  - If a question is ambiguous (could mean two packages, or v1 vs v2), ask a brief clarifying question instead of picking silently.
`;

export const POST = withRateLimit(
  async (req) => {
    const reqJson = await req.json();

    const result = streamText({
      model: chatModel,
      maxOutputTokens: 2048,
      system: systemPrompt,
      stopWhen: stepCountIs(5),
      tools: {
        searchDocs: searchTool,
      },
      messages: await convertToModelMessages<ChatUIMessage>(
        reqJson.messages ?? [],
        {
          convertDataPart(part) {
            if (part.type === "data-client") {
              return {
                type: "text",
                text: `[Client Context: ${JSON.stringify(part.data)}]`,
              };
            }
          },
          ignoreIncompleteToolCalls: true,
        }
      ),
    });

    return result.toUIMessageStreamResponse();
  },
  { tier: "moderate" }
);

const searchTool = tool({
  description:
    "Search across all `@g14o/*` documentation for specific terms, keywords, or concepts. Returns matching page slugs and snippets. Use this when you're not sure about which page contains the answer.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Search query - keywords or terms to find. e.g 'rate limit', 'cache', 'paystack', 'environment variable validation', 'better-auth'"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe("Number of results to return. Max 100."),
  }),
  async execute({ query, limit }) {
    return await searchDocs(query, limit);
  },
}) satisfies SearchTool;
