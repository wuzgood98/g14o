import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { MessageCircleIcon } from "lucide-react";
import {
  AISearch,
  AISearchPanel,
  AISearchTrigger,
} from "@/components/ai/search";
import { cn } from "@/lib/cn";
import { env } from "@/lib/env";
import { baseOptions } from "@/lib/layout.shared";
import { siteConfig } from "@/lib/site-config";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/[...slug]">) {
  return (
    <DocsLayout
      {...baseOptions()}
      githubUrl={siteConfig.githubUrl}
      tree={source.getPageTree()}
    >
      {env.ENABLE_AI_CHAT && (
        <AISearch>
          <AISearchPanel />
          <AISearchTrigger
            className={cn(
              buttonVariants({
                variant: "secondary",
                className: "rounded-2xl text-fd-muted-foreground",
              })
            )}
            position="float"
          >
            <MessageCircleIcon className="size-4.5" />
            Ask AI
          </AISearchTrigger>
        </AISearch>
      )}
      {children}
    </DocsLayout>
  );
}
