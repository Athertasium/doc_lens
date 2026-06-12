import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  const isAuthed = !!session?.user;

  const ctaHref = isAuthed ? "/upload" : "/auth/signin?callbackUrl=/upload";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 40px",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5">
            <rect x="4" y="3" width="13" height="17" rx="1" />
            <rect x="7" y="6" width="13" height="17" rx="1" fill="var(--bg)" />
          </svg>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, letterSpacing: "-0.01em", color: "var(--text)" }}>
            doclens
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isAuthed ? (
            <>
              <Link href="/sessions" style={navLinkStyle}>SESSIONS</Link>
              <Link href="/upload" style={ctaButtonStyle}>UPLOAD PDF</Link>
            </>
          ) : (
            <>
              <Link href="/auth/signin" style={navLinkStyle}>SIGN IN</Link>
              <Link href="/auth/signup" style={ctaButtonStyle}>GET STARTED</Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 40px 60px", textAlign: "center" }}>

        {/* Eyebrow */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 14px",
          border: "1px solid rgba(43,127,255,0.25)",
          borderRadius: 999,
          background: "rgba(43,127,255,0.06)",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.14em",
          color: "var(--accent)",
          marginBottom: 32,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />
          HYBRID RETRIEVAL · PGVECTOR + BM25 · CITED ANSWERS
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(36px, 6vw, 68px)",
          fontWeight: 400,
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          color: "var(--text)",
          margin: "0 0 20px",
          maxWidth: 760,
        }}>
          Read what&apos;s actually<br />
          <span style={{ color: "var(--text-dim)" }}>in the document.</span>
        </h1>

        {/* Sub */}
        <p style={{
          fontSize: 16,
          lineHeight: 1.65,
          color: "var(--text-secondary)",
          maxWidth: 480,
          margin: "0 0 44px",
          fontFamily: "var(--font-sans)",
        }}>
          Upload a PDF. Ask anything. Every answer comes with numbered citations linked to the exact page, chunk, and relevance score.
        </p>

        {/* CTA */}
        <Link href={ctaHref} style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 28px",
          borderRadius: 999,
          background: "var(--accent)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.1em",
          textDecoration: "none",
          transition: "opacity 150ms",
        }}>
          {isAuthed ? "UPLOAD A PDF" : "GET STARTED"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        {!isAuthed && (
          <p style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-faint)", letterSpacing: "0.06em" }}>
            FREE · NO CREDIT CARD ·{" "}
            <Link href="/auth/signin" style={{ color: "var(--text-dim)", textDecoration: "none" }}>
              ALREADY HAVE AN ACCOUNT?
            </Link>
          </p>
        )}

        {/* Divider */}
        <div style={{ width: "100%", maxWidth: 700, height: 1, background: "var(--border)", margin: "64px auto 0" }} />

        {/* Feature grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          maxWidth: 700,
          width: "100%",
          marginTop: 0,
        }}>
          <FeatureCard
            badge="RETRIEVAL"
            title="Hybrid Search"
            body="Dense vector similarity (pgvector) fused with BM25 keyword matching via Reciprocal Rank Fusion. Handles both semantic and exact-term queries."
          />
          <FeatureCard
            badge="CITATIONS"
            title="Cited Answers"
            body="Every factual claim gets a [N] marker tied to an exact source chunk. Score bar shows relevance — no hallucinated confidence."
          />
          <FeatureCard
            badge="EVAL SUITE"
            title="Measured Quality"
            body="100% citation accuracy. 100% abstention on out-of-scope questions. Retrieval recall and faithfulness tracked against a golden dataset."
          />
        </div>

        {/* Stack badges */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 48 }}>
          {["NEXT.JS 16", "PGVECTOR", "BM25 + RRF", "GROQ LLAMA-3.3-70B", "NVIDIA EMBEDDINGS", "NEON DB"].map((t) => (
            <span key={t} style={{
              padding: "4px 10px",
              border: "1px solid var(--border-strong)",
              borderRadius: 999,
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "0.1em",
              color: "var(--text-faint)",
            }}>
              {t}
            </span>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 40px",
        borderTop: "1px solid var(--border)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.1em",
        color: "var(--text-faint)",
      }}>
        <span>DOCLENS · RAG CITATION ENGINE</span>
        <span>V5 · PORTFOLIO PROJECT</span>
      </footer>
    </div>
  );
}

function FeatureCard({ badge, title, body }: { badge: string; title: string; body: string }) {
  return (
    <div style={{
      background: "var(--bg-app)",
      padding: "28px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      textAlign: "left",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        letterSpacing: "0.14em",
        color: "var(--accent)",
        fontWeight: 600,
      }}>
        {badge}
      </span>
      <h3 style={{
        fontFamily: "var(--font-serif)",
        fontSize: 17,
        fontWeight: 400,
        color: "var(--text)",
        margin: 0,
        letterSpacing: "-0.01em",
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 12.5,
        lineHeight: 1.65,
        color: "var(--text-dim)",
        margin: 0,
        fontFamily: "var(--font-sans)",
      }}>
        {body}
      </p>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid var(--border-strong)",
  borderRadius: 999,
  color: "var(--text-secondary)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.08em",
  textDecoration: "none",
};

const ctaButtonStyle: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: 999,
  background: "var(--accent)",
  color: "#fff",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.08em",
  fontWeight: 600,
  textDecoration: "none",
};
