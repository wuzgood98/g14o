import { ApiRunnerPanel } from "@/app/api-runner-panel";
import { AuthPanel } from "@/app/auth-panel";
import { env, maskSecret } from "@/lib/env";

export default function Page() {
  return (
    <main style={{ padding: "2rem", maxWidth: 960 }}>
      <h1>@g14o/paystack demo</h1>
      <p style={{ color: "#555" }}>
        Interactive demo for the Paystack Better Auth plugin. Environment keys
        are validated at startup via <code>@g14o/env-core</code>.
      </p>

      <section
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          fontSize: 14,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Environment</h2>
        <dl style={{ margin: 0 }}>
          <dt>
            <code>PAYSTACK_SECRET_KEY</code>
          </dt>
          <dd>{maskSecret(env.PAYSTACK_SECRET_KEY)}</dd>
          <dt>
            <code>BETTER_AUTH_URL</code>
          </dt>
          <dd>{env.BETTER_AUTH_URL}</dd>
          <dt>
            <code>SQLITE_DATABASE_PATH</code>
          </dt>
          <dd>{env.SQLITE_DATABASE_PATH}</dd>
        </dl>
      </section>

      <AuthPanel />
      <ApiRunnerPanel />

      <p style={{ marginTop: "2rem", color: "#666", fontSize: 14 }}>
        API routes: <a href="/api/env-status">GET /api/env-status</a>
        {" · "}
        <a href="/api/users">GET /api/users</a>
        {" · "}
        <a href="/api/standalone-tests">GET /api/standalone-tests</a>
        {" · "}
        <a href="/api/simulate-webhook">GET /api/simulate-webhook</a>
      </p>
    </main>
  );
}
