import { EnvClientPanel } from "@/app/env-client-panel";
import { envArktype } from "@/lib/env/arktype";
import { snapshotFromEnv, type ValidatorSnapshot } from "@/lib/env/shared";
import { envValibot } from "@/lib/env/valibot";
import { envZod } from "@/lib/env/zod";

function ValidatorCard({ snapshot }: { snapshot: ValidatorSnapshot }) {
  return (
    <article
      style={{
        flex: "1 1 200px",
        padding: "1rem",
        border: "1px solid #ddd",
        borderRadius: 8,
        background: "#fafafa",
      }}
    >
      <h3 style={{ marginTop: 0, textTransform: "capitalize" }}>
        {snapshot.validator}
      </h3>
      <dl style={{ margin: 0, fontSize: 14 }}>
        <dt>
          <code>DATABASE_URL</code>
        </dt>
        <dd style={{ marginBottom: "0.75rem", wordBreak: "break-all" }}>
          {snapshot.databaseUrl}
        </dd>
        <dt>
          <code>OPEN_AI_API_KEY</code>
        </dt>
        <dd style={{ marginBottom: "0.75rem" }}>
          {snapshot.openAiApiKeyMasked}
        </dd>
        <dt>
          <code>NEXT_PUBLIC_API_URL</code>
        </dt>
        <dd style={{ marginBottom: "0.75rem", wordBreak: "break-all" }}>
          {snapshot.nextPublicApiUrl}
        </dd>
        <dt>
          <code>NEXT_PUBLIC_APP_NAME</code>
        </dt>
        <dd>{snapshot.nextPublicAppName}</dd>
      </dl>
    </article>
  );
}

export default function Page() {
  const snapshots = [
    snapshotFromEnv("zod", envZod),
    snapshotFromEnv("valibot", envValibot),
    snapshotFromEnv("arktype", envArktype),
  ];

  return (
    <main style={{ padding: "2rem", maxWidth: 960 }}>
      <h1>@g14o/env-core validator demo</h1>
      <p style={{ color: "#555" }}>
        This page imported three <code>createEnv</code> modules at startup. If
        you see the cards below, Zod, Valibot, and ArkType all validated the
        same <code>.env.local</code> contract on the server.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {snapshots.map((snapshot) => (
          <ValidatorCard key={snapshot.validator} snapshot={snapshot} />
        ))}
      </div>

      <EnvClientPanel />

      <p style={{ marginTop: "2rem", color: "#666", fontSize: 14 }}>
        API: <a href="/api/env-status">GET /api/env-status</a>
      </p>
    </main>
  );
}
