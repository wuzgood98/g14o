import type { Generator } from "fumadocs-typescript";
import type { ReactNode } from "react";
import {
  createTypeTableRenderers,
  parseDocTags,
  resolveDisplayType,
} from "@/lib/type-table-render";
import { DocsTable } from "./docs-table";

type GenerateTypeTableOptions = NonNullable<
  Parameters<Generator["generateTypeTable"]>[1]
>;

interface OptionsTableProps {
  generator: Generator;
  name: string;
  nameLabel?: "Option" | "Prop";
  options?: GenerateTypeTableOptions;
  path: string;
}

const inlineCodeClass =
  "rounded-md border border-fd-border bg-fd-muted px-1.5 py-0.5 text-sm";

export async function OptionsTable({
  generator,
  path,
  name,
  nameLabel = "Option",
  options,
}: OptionsTableProps) {
  const { renderType, renderMarkdown } = createTypeTableRenderers();
  const docs = await generator.generateTypeTable({ path, name }, options);

  if (docs.length === 0) {
    return null;
  }

  const doc = docs[0];
  if (!doc) {
    return null;
  }

  const rows = await Promise.all(
    doc.entries.map(async (entry) => {
      const tags = parseDocTags(entry.tags);
      const descriptionParts: ReactNode[] = [];

      if (entry.description) {
        descriptionParts.push(
          <div key="description">{await renderMarkdown(entry.description)}</div>
        );
      }

      if (tags.defaultValue) {
        descriptionParts.push(
          <span className="mt-1 block text-fd-muted-foreground" key="default">
            Default:{" "}
            <code className="rounded-md bg-fd-muted px-1.5 py-0.5 text-sm">
              {tags.defaultValue}
            </code>
          </span>
        );
      }

      return {
        key: entry.name,
        name: entry.name,
        required: entry.required,
        deprecated: entry.deprecated,
        type: await renderType(resolveDisplayType(entry)),
        description:
          descriptionParts.length > 0 ? (
            <div className="prose prose-sm prose-no-margin dark:prose-invert max-w-none">
              {descriptionParts}
            </div>
          ) : null,
      };
    })
  );

  return (
    <DocsTable className="not-prose">
      <thead>
        <tr>
          <th style={{ width: "22%" }}>{nameLabel}</th>
          <th style={{ width: "28%" }}>Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>
              <code
                className={
                  row.deprecated
                    ? "font-medium font-mono text-fd-primary/50 line-through"
                    : inlineCodeClass
                }
              >
                {row.name}
                {row.required ? "" : "?"}
              </code>
            </td>
            <td className="font-mono text-sm">
              <code className={inlineCodeClass}>{row.type}</code>
            </td>
            <td>{row.description}</td>
          </tr>
        ))}
      </tbody>
    </DocsTable>
  );
}
