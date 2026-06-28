import { env } from "@/lib/env";

const APP_NAME = "g14o";

export const siteConfig = {
  name: APP_NAME,
  baseUrl: env.NEXT_PUBLIC_APP_URL,
  description: "Documentation for the @g14o/* npm packages",
  keywords: [APP_NAME, "npm", "packages", "documentation", "api", "reference"],
  author: {
    name: APP_NAME,
    url: "https://g14o.dev",
  },
  creator: APP_NAME,
  githubUrl: "https://github.com/wuzgood98/g14o",
};
