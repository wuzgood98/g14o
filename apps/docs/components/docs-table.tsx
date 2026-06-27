import type { ReactNode } from "react";

interface DocsTableProps {
  children: ReactNode;
  className?: string;
  minWidth?: string;
}

export function DocsTable({
  children,
  className,
  minWidth = "640px",
}: DocsTableProps) {
  return (
    <div className={className ? `fd-docs-table ${className}` : "fd-docs-table"}>
      <table style={{ minWidth }}>{children}</table>
    </div>
  );
}
