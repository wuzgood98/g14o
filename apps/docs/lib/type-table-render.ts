/** biome-ignore-all lint/performance/noNamespaceImport: it's a workaround to avoid the error */
import { highlightHast } from "fumadocs-core/highlight";
import { rehypeCode } from "fumadocs-core/mdx-plugins/rehype-code";
import { remarkGfm } from "fumadocs-core/mdx-plugins/remark-gfm";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ElementContent, Nodes, Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ReactNode } from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { remark } from "remark";
import remarkRehype from "remark-rehype";

function removeWhitespaceNodes(
  node: Root | { type: "element"; children: ElementContent[] }
): void {
  node.children = node.children.filter(
    (child) => child.type !== "text" || child.value.trim().length > 0
  );

  for (const child of node.children) {
    if (child.type === "element") {
      removeWhitespaceNodes(child);
    }
  }
}

function toJsx(hast: Nodes): ReactNode {
  return toJsxRuntime(hast, {
    ...JsxRuntime,
    components: {
      ...defaultMdxComponents,
      img: undefined,
    },
  });
}
export function createTypeTableRenderers() {
  const processor = remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeCode, { langs: ["ts", "tsx"] });

  return {
    renderType: async (type: string): Promise<ReactNode> =>
      toJsx({
        type: "element",
        tagName: "span",
        properties: { class: "shiki" },
        children: [
          {
            type: "element",
            tagName: "code",
            properties: {},
            children: (
              await highlightHast(type, {
                lang: "ts",
                structure: "inline",
                defaultColor: false,
              })
            ).children as ElementContent[],
          },
        ],
      }),
    renderMarkdown: async (md: string): Promise<ReactNode> => {
      const normalized = md.replace(/{@link (?<link>[^}]*)}/g, "$1");
      const hast = await processor.run(processor.parse(normalized));

      if (hast.type === "root") {
        removeWhitespaceNodes(hast);
      }

      return toJsx(hast);
    },
  };
}

interface RawTag {
  name: string;
  text: string;
}

interface TypeTableEntry {
  simplifiedType: string;
  type: string;
}

const OPAQUE_SIMPLIFIED_TYPES = new Set(["union"]);

const PAYSTACK_WEBHOOK_EVENT_PATTERN = /^\{ event: "/;

function isPaystackWebhookEventUnion(type: string): boolean {
  return PAYSTACK_WEBHOOK_EVENT_PATTERN.test(type.trimStart());
}

export function resolveDisplayType(entry: TypeTableEntry): string {
  if (
    entry.simplifiedType === "union" &&
    isPaystackWebhookEventUnion(entry.type)
  ) {
    return "PaystackWebhookEvent";
  }

  if (OPAQUE_SIMPLIFIED_TYPES.has(entry.simplifiedType)) {
    return entry.type;
  }

  return entry.simplifiedType;
}

export function parseDocTags(tags: RawTag[]) {
  let defaultValue: string | undefined;

  for (const { name: key, text } of tags) {
    if (key === "default" || key === "defaultValue") {
      defaultValue = text;
    }
  }

  return { defaultValue };
}
