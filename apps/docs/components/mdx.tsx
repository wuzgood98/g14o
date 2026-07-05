/** biome-ignore-all lint/performance/noNamespaceImport: it's a workaround to avoid the error */

import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import * as TabsComponents from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
import { typeScriptGenerator } from "@/lib/typescript-generator";
import { DatabaseTable } from "./database-table";
import { DefaultTiersTable } from "./default-tiers-table";
import { Mermaid } from "./mermaid";
import { OptionsTable } from "./options-table";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,

    ...TabsComponents,
    Mermaid,
    DatabaseTable,
    DefaultTiersTable,

    OptionsTable: (
      props: Omit<ComponentProps<typeof OptionsTable>, "generator">
    ) => <OptionsTable generator={typeScriptGenerator} {...props} />,

    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),

    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
