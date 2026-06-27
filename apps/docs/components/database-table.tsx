import type { TypeNode } from "fumadocs-ui/components/type-table";
import type { ReactNode } from "react";
import {
  type PaystackSchemaTableKey,
  paystackSchemaTables,
} from "@/lib/paystack-schema-docs";
import { createTypeTableRenderers } from "@/lib/type-table-render";
import { DocsTable } from "./docs-table";

interface DatabaseTableProps {
  table: PaystackSchemaTableKey;
}

const inlineCodeClass =
  "rounded-md border border-fd-border bg-fd-muted px-1.5 py-0.5 text-sm";
const typeHighlightClass =
  "inline-flex items-center rounded-md border border-fd-border bg-fd-muted/50 px-1.5 py-0.5";
const requiredBadgeClass =
  "rounded-md border border-fd-error/20 bg-fd-error/10 px-1.5 py-0.5 font-medium font-sans text-fd-error text-xs";

function renderWhenNote(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  let offset = 0;

  return parts.map((part) => {
    const key = `when-note-${offset}`;
    offset += part.length;

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code className={inlineCodeClass} key={key}>
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

function renderFieldDescription(node: TypeNode): ReactNode {
  const parts: ReactNode[] = [];

  if (node.description) {
    parts.push(node.description);
  }

  if (node.default !== undefined) {
    parts.push(
      <span className="mt-1 block text-fd-muted-foreground" key="default">
        Default: <code className={inlineCodeClass}>{String(node.default)}</code>
      </span>
    );
  }

  if (parts.length === 0) {
    return null;
  }

  return <div>{parts}</div>;
}

export async function DatabaseTable({ table }: DatabaseTableProps) {
  const config = paystackSchemaTables[table];
  const fields = Object.entries(config.type);
  const { renderType } = createTypeTableRenderers();

  const rows = await Promise.all(
    fields.map(async ([name, node]) => ({
      name,
      node,
      highlightedType: await renderType(String(node.type)),
      isRequired: node.required !== false,
    }))
  );

  return (
    <div className="not-prose my-6">
      {config.when ? (
        <p className="mb-2 text-fd-muted-foreground text-sm">
          {renderWhenNote(config.when)}
        </p>
      ) : null}
      <p className="mb-4 font-medium text-sm">
        Table Name: <code className={inlineCodeClass}>{config.name}</code>
        {config.extendsCore ? (
          <span className="font-normal text-fd-muted-foreground">
            {" "}
            (extends core <code className={inlineCodeClass}>user</code> table)
          </span>
        ) : null}
      </p>
      <DocsTable>
        <thead>
          <tr>
            <th style={{ width: "22%" }}>Field</th>
            <th style={{ width: "28%" }}>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <code className={inlineCodeClass}>
                  {row.name}
                  {row.node.required === false ? "?" : ""}
                </code>
              </td>
              <td className="font-mono text-sm">
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className={typeHighlightClass}>
                    {row.highlightedType}
                  </span>
                  {row.isRequired ? (
                    <span className={requiredBadgeClass}>Required</span>
                  ) : null}
                </span>
              </td>
              <td>{renderFieldDescription(row.node)}</td>
            </tr>
          ))}
        </tbody>
      </DocsTable>
    </div>
  );
}
