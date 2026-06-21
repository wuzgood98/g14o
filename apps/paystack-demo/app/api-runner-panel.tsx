"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";

const panelStyle = {
  marginTop: "1.5rem",
  padding: "1.25rem",
  border: "1px solid #ddd",
  borderRadius: 8,
} as const;

const buttonStyle = {
  padding: "0.5rem 1rem",
  cursor: "pointer",
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "#f5f5f5",
  marginRight: "0.5rem",
  marginBottom: "0.5rem",
} as const;

interface ApiResult {
  data: unknown;
  error?: string;
  label: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  return response.json();
}

export function ApiRunnerPanel() {
  const [results, setResults] = useState<ApiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [webhookEvent, setWebhookEvent] = useState("charge.success");

  function pushResult(label: string, data: unknown, error?: string) {
    setResults((current) => [{ label, data, error }, ...current].slice(0, 20));
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setLoading(true);
    try {
      const data = await fn();
      const requiredEvents = new Set([
        "subscription.createCheckoutSession",
        "subscription.upgrade",
      ]);
      if (requiredEvents.has(label)) {
        console.log({ data });
        const subData = data as {
          data: { authorizationUrl: string } | undefined;
        };
        if (!subData.data?.authorizationUrl) {
          throw new Error("Authorization URL not found");
        }
        window.location.assign(subData.data.authorizationUrl);
        return;
      }
      pushResult(label, data);
    } catch (error) {
      pushResult(
        label,
        null,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={panelStyle}>
      <h2>API runner</h2>
      <button
        disabled={loading}
        onClick={() => setResults([])}
        style={buttonStyle}
        type="button"
      >
        Clear results
      </button>
      <p style={{ color: "#555", fontSize: 14 }}>
        Exercises standalone Paystack client routes, Better Auth server plugin
        endpoints, client plugin actions, and webhook simulation.
      </p>

      <h3 style={{ fontSize: 16 }}>Standalone Paystack client</h3>
      <button
        disabled={loading}
        onClick={() =>
          run("GET /api/standalone-tests", () =>
            fetchJson("/api/standalone-tests")
          )
        }
        style={buttonStyle}
        type="button"
      >
        Run standalone client tests
      </button>

      <h3 style={{ fontSize: 16, marginTop: "1.25rem" }}>Users</h3>
      <button
        disabled={loading}
        onClick={() => run("GET /api/users", () => fetchJson("/api/users"))}
        style={buttonStyle}
        type="button"
      >
        Fetch users
      </button>

      <h3 style={{ fontSize: 16, marginTop: "1.25rem" }}>
        Server plugin (auth.api.*)
      </h3>
      <button
        disabled={loading}
        onClick={() =>
          run("GET /api/plugin-tests", () => fetchJson("/api/plugin-tests"))
        }
        style={buttonStyle}
        type="button"
      >
        Run all server plugin tests
      </button>

      <h3 style={{ fontSize: 16, marginTop: "1.25rem" }}>
        Client plugin (authClient.subscription.*)
      </h3>
      <button
        disabled={loading}
        onClick={() =>
          run("subscription.createCheckoutSession", async () => {
            const res = await authClient.paystack.createCheckoutSession({
              email: "demo@example.com",
              amount: 500,
              currency: "GHS",
              callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
              channels: [
                "card",
                "bank",
                "mobile_money",
                "bank_transfer",
                "apple_pay",
              ],
              disableRedirect: true,
            });
            return res;
          })
        }
        style={buttonStyle}
        type="button"
      >
        createCheckoutSession
      </button>
      <button
        disabled={loading}
        onClick={() =>
          run("subscription.upgrade", async () => {
            const res = await authClient.paystack.subscription.upgrade({
              plan: "pro",
              annual: false,
              callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
              cancelActionUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
              channels: ["card", "mobile_money", "bank_transfer"],
              disableRedirect: true,
            });
            return res;
          })
        }
        style={buttonStyle}
        type="button"
      >
        upgrade to pro
      </button>
      <button
        disabled={loading}
        onClick={() =>
          run("subscription.upgrade", async () => {
            const res = await authClient.paystack.subscription.upgrade({
              plan: "basic",
              callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
              cancelActionUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
              channels: ["card", "mobile_money", "bank_transfer"],
              disableRedirect: true,
            });
            return res;
          })
        }
        style={buttonStyle}
        type="button"
      >
        upgrade to basic
      </button>
      <button
        disabled={loading}
        onClick={() =>
          run("subscription.upgrade", async () => {
            const res = await authClient.paystack.subscription.upgrade({
              plan: "basic",
              annual: true,
              callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
              cancelActionUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
              channels: ["card", "mobile_money", "bank_transfer"],
              disableRedirect: true,
            });
            return res;
          })
        }
        style={buttonStyle}
        type="button"
      >
        upgrade to basic annually
      </button>
      <button
        disabled={loading}
        onClick={() =>
          run("subscription.list", async () => {
            const res = await authClient.paystack.subscription.list();
            return res;
          })
        }
        style={buttonStyle}
        type="button"
      >
        list
      </button>
      <button
        disabled={loading}
        onClick={() =>
          run("subscription.get", async () => {
            const res = await authClient.paystack.subscription.get();
            return res;
          })
        }
        style={buttonStyle}
        type="button"
      >
        getSubscription
      </button>
      <button
        disabled={loading}
        onClick={() =>
          run("subscription.cancel", async () => {
            const res = await authClient.paystack.subscription.cancel();
            return res;
          })
        }
        style={buttonStyle}
        type="button"
      >
        cancel
      </button>
      <button
        disabled={loading}
        onClick={() =>
          run("subscription.resume", async () => {
            const res = await authClient.paystack.subscription.resume();
            return res;
          })
        }
        style={buttonStyle}
        type="button"
      >
        resume
      </button>

      <h3 style={{ fontSize: 16, marginTop: "1.25rem" }}>Webhook simulation</h3>
      <label htmlFor="webhook-event" style={{ fontSize: 14 }}>
        Event type
        <select
          id="webhook-event"
          onChange={(event) => setWebhookEvent(event.target.value)}
          style={{
            display: "block",
            marginTop: "0.5rem",
            marginBottom: "0.75rem",
            padding: "0.5rem",
          }}
          value={webhookEvent}
        >
          <option value="charge.success">charge.success</option>
          <option value="subscription.create">subscription.create</option>
          <option value="subscription.disable">subscription.disable</option>
          <option value="subscription.not_renew">subscription.not_renew</option>
          <option value="invoice.create">invoice.create</option>
          <option value="invoice.update">invoice.update</option>
          <option value="invoice.payment_failed">invoice.payment_failed</option>
          <option value="subscription.expiring_cards">
            subscription.expiring_cards
          </option>
        </select>
      </label>
      <button
        disabled={loading}
        onClick={() =>
          run("POST /api/simulate-webhook", () =>
            fetchJson("/api/simulate-webhook", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: webhookEvent,
                data: {
                  reference: `ref_sim_${Date.now()}`,
                  amount: 800,
                  currency: "GHS",
                  status: "success",
                },
              }),
            })
          )
        }
        style={buttonStyle}
        type="button"
      >
        Simulate webhook
      </button>

      {results.length > 0 ? (
        <div style={{ marginTop: "1.5rem" }}>
          <h3 style={{ fontSize: 16 }}>Results</h3>
          {results.map((result) => (
            <details
              key={`${result.label}-${JSON.stringify(result.data).slice(0, 40)}`}
              open
              style={{
                marginBottom: "0.75rem",
                border: "1px solid #eee",
                borderRadius: 6,
                padding: "0.75rem",
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                {result.label}
                {result.error ? " — error" : ""}
              </summary>
              {result.error ? (
                <pre
                  style={{
                    color: "#b91c1c",
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {result.error}
                </pre>
              ) : null}
              <pre
                style={{
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  marginTop: "0.5rem",
                }}
              >
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}
