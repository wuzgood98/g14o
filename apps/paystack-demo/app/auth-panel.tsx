"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const panelStyle = {
  marginTop: "1.5rem",
  padding: "1.25rem",
  border: "1px solid #ddd",
  borderRadius: 8,
} as const;

const inputStyle = {
  display: "block",
  width: "100%",
  marginBottom: "0.75rem",
  padding: "0.5rem",
  borderRadius: 6,
  border: "1px solid #ccc",
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

export function AuthPanel() {
  const [email, setEmail] = useState("demo+paystack@example.com");
  const [password, setPassword] = useState("demo-password-123");
  const [name, setName] = useState("Paystack Demo");
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    paystackCustomerCode?: string | null;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshSession() {
    const { data } = await authClient.getSession();
    setCurrentUser(data?.user ?? null);
  }

  async function handleSignUp() {
    setMessage(null);
    setError(null);
    const { data, error: signUpError } = await authClient.signUp.email({
      email,
      password,
      name,
    });

    if (signUpError) {
      setError(signUpError.message ?? "Sign up failed");
      return;
    }

    setMessage(`Signed up as ${data?.user.email}`);
    await refreshSession();
  }

  async function handleSignIn() {
    setMessage(null);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message ?? "Sign in failed");
      return;
    }

    setMessage(`Signed in as ${data?.user.email}`);
    await refreshSession();
  }

  async function handleSignOut() {
    setMessage(null);
    setError(null);
    await authClient.signOut();
    setCurrentUser(null);
    setMessage("Signed out");
  }

  return (
    <section style={panelStyle}>
      <h2>Authentication</h2>
      <p style={{ color: "#555", fontSize: 14 }}>
        Email/password auth backed by SQLite. Sign-up triggers Paystack customer
        creation when <code>createCustomerOnSignUp</code> is enabled.
      </p>

      <label htmlFor="auth-name">
        Name
        <input
          id="auth-name"
          onChange={(event) => setName(event.target.value)}
          style={inputStyle}
          value={name}
        />
      </label>
      <label htmlFor="auth-email">
        Email
        <input
          id="auth-email"
          onChange={(event) => setEmail(event.target.value)}
          style={inputStyle}
          type="email"
          value={email}
        />
      </label>
      <p
        style={{
          color: "#555",
          fontSize: 13,
          marginTop: "-0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        Paystack requires a real-looking email address. Domains like{" "}
        <code>.test</code> are rejected.
      </p>
      <label htmlFor="auth-password">
        Password
        <input
          id="auth-password"
          onChange={(event) => setPassword(event.target.value)}
          style={inputStyle}
          type="password"
          value={password}
        />
      </label>

      <div>
        <button onClick={handleSignUp} style={buttonStyle} type="button">
          Sign up
        </button>
        <button onClick={handleSignIn} style={buttonStyle} type="button">
          Sign in
        </button>
        <button onClick={handleSignOut} style={buttonStyle} type="button">
          Sign out
        </button>
        <button onClick={refreshSession} style={buttonStyle} type="button">
          Refresh session
        </button>
      </div>

      {currentUser ? (
        <dl
          style={{
            marginTop: "1rem",
            fontSize: 14,
            background: "#f8fafc",
            padding: "0.75rem 1rem",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
          }}
        >
          <dt style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
            Current user
          </dt>
          <dd style={{ margin: 0 }}>
            <strong>{currentUser.name}</strong> ({currentUser.email})
          </dd>
          <dd style={{ margin: "0.25rem 0 0", fontSize: 13, color: "#555" }}>
            id: <code>{currentUser.id}</code>
          </dd>
          {currentUser.paystackCustomerCode ? (
            <dd style={{ margin: "0.25rem 0 0", fontSize: 13, color: "#555" }}>
              paystackCustomerCode:{" "}
              <code>{currentUser.paystackCustomerCode}</code>
            </dd>
          ) : null}
        </dl>
      ) : (
        <p style={{ marginTop: "1rem", fontSize: 14 }}>
          Session: <strong>none — sign in to test plugin APIs</strong>
        </p>
      )}

      {message ? (
        <p style={{ color: "#166534", fontSize: 14 }}>{message}</p>
      ) : null}
      {error ? <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p> : null}
    </section>
  );
}
