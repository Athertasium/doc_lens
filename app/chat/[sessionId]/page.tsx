"use client";

import { useParams } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

interface Citation {
  chunkId: string;
  score: number;
  rrfScore?: number;
  pageNumber: number;
  snippet: string;
  filename: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  latencyMs?: number;
}

export default function ChatPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? "Query failed");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const { answer, citations, latencyMs } = json.data;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, citations, latencyMs },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--border-subtle)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
      }}>
        <Link href="/" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
        <div style={{ width: 1, height: 16, background: "var(--border-subtle)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
          <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>DocLens</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginLeft: 4 }}>
          {sessionId.slice(0, 8)}…
        </span>
      </header>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 24 }}>
          {messages.length === 0 && (
            <EmptyState />
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <UserBubble content={msg.content} />
              ) : (
                <AssistantBubble
                  content={msg.content}
                  citations={msg.citations ?? []}
                  latencyMs={msg.latencyMs}
                />
              )}
            </div>
          ))}

          {loading && <ThinkingBubble />}
          {error && <ErrorBanner message={error} />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "16px 24px", flexShrink: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your document…"
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "10px 14px",
              color: "var(--text)",
              fontSize: 14,
              fontFamily: "var(--font-sans)",
              resize: "none",
              outline: "none",
              lineHeight: 1.5,
              maxHeight: 120,
              overflowY: "auto",
              opacity: loading ? 0.6 : 1,
            }}
          />
          <button
            onClick={submit}
            disabled={loading || !input.trim()}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: loading || !input.trim() ? "var(--surface-2)" : "var(--accent)",
              color: loading || !input.trim() ? "var(--text-dim)" : "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "background 150ms, color 150ms",
              flexShrink: 0,
              height: 42,
            }}
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
        <p style={{ maxWidth: 720, margin: "8px auto 0", fontSize: 11, color: "var(--text-dim)" }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{
        background: "var(--accent)",
        color: "#fff",
        borderRadius: "16px 16px 4px 16px",
        padding: "10px 16px",
        maxWidth: "80%",
        fontSize: 14,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({
  content,
  citations,
  latencyMs,
}: {
  content: string;
  citations: Citation[];
  latencyMs?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleCitation(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const renderedContent = renderCitations(content);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" fill="var(--accent)" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px 16px 16px 16px",
            padding: "12px 16px",
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {renderedContent}
          </div>

          {latencyMs !== undefined && (
            <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              {latencyMs}ms
            </p>
          )}
        </div>
      </div>

      {citations.length > 0 && (
        <div style={{ paddingLeft: 40, display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginBottom: 2 }}>
            {citations.length} CITATION{citations.length > 1 ? "S" : ""}
          </p>
          {citations.map((c, i) => (
            <CitationCard
              key={c.chunkId}
              index={i + 1}
              citation={c}
              open={expanded.has(c.chunkId)}
              onToggle={() => toggleCitation(c.chunkId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CitationCard({
  index,
  citation,
  open,
  onToggle,
}: {
  index: number;
  citation: Citation;
  open: boolean;
  onToggle: () => void;
}) {
  const scoreColor =
    citation.score >= 0.85
      ? "var(--green)"
      : citation.score >= 0.65
      ? "var(--yellow)"
      : "var(--red)";

  return (
    <div
      onClick={onToggle}
      style={{
        border: `1px solid ${open ? "var(--border)" : "var(--border-subtle)"}`,
        borderRadius: 8,
        background: open ? "var(--surface)" : "transparent",
        cursor: "pointer",
        transition: "border-color 100ms, background 100ms",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--accent)",
          background: "var(--accent-glow)",
          padding: "2px 6px",
          borderRadius: 4,
          flexShrink: 0,
        }}>
          [{index}]
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {citation.filename} · p.{citation.pageNumber}
        </span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ScoreBar score={citation.score} color={scoreColor} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: scoreColor }}>
              {citation.score.toFixed(3)}
            </span>
          </div>
          {citation.rrfScore !== undefined && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
              rrf {citation.rrfScore.toFixed(4)}
            </span>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          style={{ flexShrink: 0, transition: "transform 150ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M6 9l6 6 6-6" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "10px 12px" }}>
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            &ldquo;{citation.snippet}{citation.snippet.length >= 300 ? "…" : ""}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ width: 48, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        width: `${Math.round(score * 100)}%`,
        height: "100%",
        background: color,
        borderRadius: 2,
        transition: "width 300ms ease",
      }} />
    </div>
  );
}

function renderCitations(text: string): React.ReactNode[] {
  const parts = text.split(/(\[\d+(?:,\s*\d+)*\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
    if (!match) return <span key={i}>{part}</span>;
    return (
      <sup key={i} style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.65em",
        color: "var(--accent)",
        background: "var(--accent-glow)",
        padding: "1px 4px",
        borderRadius: 3,
        marginLeft: 2,
        cursor: "default",
      }}>
        {part}
      </sup>
    );
  });
}

function ThinkingBubble() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, border: "1.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
      <div style={{ padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "4px 16px 16px 16px" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {[0, 150, 300].map((delay) => (
            <div key={delay} style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--text-dim)",
              animation: `pulse 1.2s ease-in-out ${delay}ms infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      padding: "10px 14px",
      borderRadius: 8,
      border: "1px solid rgba(248,113,113,0.3)",
      background: "rgba(248,113,113,0.06)",
      color: "var(--red)",
      fontSize: 13,
      fontFamily: "var(--font-mono)",
    }}>
      {message}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 0 20px" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Ask anything about your document</p>
      <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 6 }}>Answers include cited sources with relevance scores</p>
    </div>
  );
}
