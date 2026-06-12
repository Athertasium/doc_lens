"use client";

import { signIn } from "next-auth/react";
import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/upload";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email: email.toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5">
              <rect x="4" y="3" width="13" height="17" rx="1" />
              <rect x="7" y="6" width="13" height="17" rx="1" fill="var(--bg)" />
            </svg>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)", letterSpacing: "-0.01em" }}>
              doclens
            </span>
          </Link>
          <p style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--text-faint)" }}>
            READ WHAT&apos;S ACTUALLY IN THE DOCUMENT
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-app)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "32px 28px",
        }}>
          <h1 style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
            marginBottom: 24,
            textAlign: "center",
          }}>
            SIGN IN
          </h1>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--text-faint)" }}>
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--text-faint)" }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
              />
            </div>

            {error && (
              <div style={{
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px solid rgba(248,113,113,0.25)",
                background: "rgba(248,113,113,0.05)",
                color: "var(--red)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                padding: "11px 0",
                borderRadius: 6,
                border: "none",
                background: loading ? "rgba(43,127,255,0.3)" : "var(--accent)",
                color: "#fff",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.1em",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 150ms",
              }}
            >
              {loading ? "SIGNING IN…" : "SIGN IN"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12.5, color: "var(--text-dim)" }}>
          No account?{" "}
          <Link href="/auth/signup" style={{ color: "var(--accent)", textDecoration: "none" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(238,238,238,0.04)",
  border: "1px solid var(--border-strong)",
  borderRadius: 6,
  padding: "10px 14px",
  color: "var(--text)",
  fontSize: 13.5,
  fontFamily: "var(--font-sans)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 150ms",
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
