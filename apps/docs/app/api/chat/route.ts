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
  You are a helpful documentation assistant for the g14o, a monorepo of npm packages for caching, rate limiting, environment variable validation, Paystack API client, and Paystack billing plugin for Better Auth.
  Your role is to answer questions about the g14o (@g14o/* npm packages). You should be accurate, concise, and helpful.

  ## Rules
  - Always loop relevant documentation before answering a question. Do NOT guess or make up information.
  - Always use searchDocs tool to retrieve relevant docs context before answering when needed. The searchDocs tool returns search results from documentation. Use those results to ground your answer and cite sources as markdown links using the document url field when available.
  - Keep answers focused and concise. Avoid unnecessary verbosity. Don't dump the entire documentation page in your answer. Extract only the relevant parts
  - If you cannot find the answer in search results, say so, and suggest a better search query rather than guessing.

  You should be able to answer questions about the following topics:
  - @g14o/cache
  - @g14o/ratelimit
  - @g14o/ratelimit-nextjs
  - @g14o/env-core
  - @g14o/paystack
  - @g14o/paystack-better-auth
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
    return await searchDocs(query, limit); // TODO: return a more detailed response with the page slug and snippet
  },
}) satisfies SearchTool;
