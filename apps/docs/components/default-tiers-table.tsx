import { rateLimitTierDefaults } from "@/lib/ratelimit-tier-docs";
import { DocsTable } from "./docs-table";

const inlineCodeClass =
  "rounded-md border border-fd-border bg-fd-muted px-1.5 py-0.5 text-sm";

export function DefaultTiersTable() {
  return (
    <DocsTable className="not-prose my-6">
      <thead>
        <tr>
          <th style={{ width: "14%" }}>Tier</th>
          <th style={{ width: "10%" }}>Limit</th>
          <th style={{ width: "12%" }}>Window</th>
          <th style={{ width: "24%" }}>Prefix</th>
          <th>Typical use</th>
        </tr>
      </thead>
      <tbody>
        {rateLimitTierDefaults.map((row) => (
          <tr key={row.tier}>
            <td>
              <code className={inlineCodeClass}>{row.tier}</code>
            </td>
            <td>{row.limit}</td>
            <td>
              <code className={inlineCodeClass}>{row.window}</code>
            </td>
            <td>
              <code className={inlineCodeClass}>{row.prefix}</code>
            </td>
            <td>{row.usage}</td>
          </tr>
        ))}
      </tbody>
    </DocsTable>
  );
}
