"use client";

import { useState } from "react";
import { envZod } from "@/lib/env/zod";

export function EnvClientPanel() {
  const [serverAccessError, setServerAccessError] = useState<string | null>(
    null
  );

  function tryServerKeyOnClient() {
    setServerAccessError(null);
    try {
      Boolean(envZod.DATABASE_URL);
      setServerAccessError("Unexpected success — server value leaked");
    } catch (error) {
      setServerAccessError(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return (
    <section
      style={{
        marginTop: "2rem",
        padding: "1.25rem",
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <h2>Client bundle</h2>
      <p style={{ color: "#555", fontSize: 14 }}>
        Client-safe variables from the Zod config (same values as Valibot and
        ArkType via shared <code>.env.local</code>).
      </p>
      <dl style={{ margin: "1rem 0" }}>
        <dt>
          <code>NEXT_PUBLIC_API_URL</code>
        </dt>
        <dd>{envZod.NEXT_PUBLIC_API_URL}</dd>
        <dt>
          <code>NEXT_PUBLIC_APP_NAME</code>
        </dt>
        <dd>{envZod.NEXT_PUBLIC_APP_NAME}</dd>
      </dl>
      <button
        onClick={tryServerKeyOnClient}
        style={{
          padding: "0.5rem 1rem",
          cursor: "pointer",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "#f5f5f5",
        }}
        type="button"
      >
        Try server key on client (Zod)
      </button>
      {serverAccessError ? (
        <pre
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {serverAccessError}
        </pre>
      ) : null}
    </section>
  );
}
