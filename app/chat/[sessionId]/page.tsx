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
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  latencyMs?: number;
  docMeta?: { filename: string; chunkCount: number; pageCount?: number };
}

interface CitationGroup {
  question: string;
  citations: Citation[];
  msgIndex: number;
}

export default function ChatPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFile = useCallback(async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      setError("Only PDF files accepted");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("sessionId", sessionId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Upload failed");
        return;
      }
      const { chunkCount, pageCount } = json.data;
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "",
          docMeta: { filename: file.name, chunkCount: chunkCount ?? 0, pageCount },
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [sessionId]);

  const msgCount = messages.filter((m) => m.role !== "system").length;

  // Accumulate all citation groups across all turns
  const citationGroups: CitationGroup[] = messages.reduce<CitationGroup[]>((acc, msg, i) => {
    if (msg.role === "assistant" && msg.citations && msg.citations.length > 0) {
      const question = messages[i - 1]?.content ?? "";
      acc.push({ question, citations: msg.citations, msgIndex: i });
    }
    return acc;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>

      {/* Top bar */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        gap: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5">
              <rect x="4" y="3" width="13" height="17" rx="1" />
              <rect x="7" y="6" width="13" height="17" rx="1" fill="var(--bg)" />
            </svg>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, letterSpacing: "-0.01em", color: "var(--text)" }}>
              doclens
            </span>
          </Link>
          <span style={{ width: 1, height: 18, background: "var(--border-strong)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--text-faint)" }}>
            SESSION {sessionId.slice(0, 8).toUpperCase()}
            {msgCount > 0 && ` · ${msgCount} MESSAGE${msgCount > 1 ? "S" : ""}`}
          </span>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <HeaderBtn>EXPORT</HeaderBtn>
          <HeaderBtn>SHARE</HeaderBtn>
          <Link
            href="/"
            style={{
              padding: "6px 14px",
              background: "var(--text)",
              border: "1px solid var(--text)",
              color: "#0a0a0c",
              borderRadius: 999,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.08em",
              cursor: "pointer",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            NEW SESSION
          </Link>
        </div>
      </header>

      {/* Body: two-panel on wide, single on narrow */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 460px", minHeight: 0, overflow: "hidden" }}>

        {/* Left: context panel */}
        <div style={{
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-pdf)",
          minHeight: 0,
          overflow: "hidden",
        }}>
          <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "var(--text-faint)" }}>
              CONTEXT
            </span>
            {citationGroups.length > 0 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em" }}>
                {citationGroups.reduce((n, g) => n + g.citations.length, 0)} CHUNKS · {citationGroups.length} TURN{citationGroups.length > 1 ? "S" : ""}
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
            {citationGroups.length === 0 ? (
              <ContextEmpty />
            ) : (
              citationGroups.map((group) => (
                <ContextGroup key={group.msgIndex} group={group} />
              ))
            )}
          </div>
        </div>

        {/* Right: chat panel */}
        <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-chat)", minHeight: 0 }}>

          {/* Chat header */}
          <div style={{
            padding: "14px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              background: "linear-gradient(135deg, #2b7fff, #1a365d)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-serif)",
              fontSize: 13,
              color: "#ffffff",
              fontWeight: 700,
              flexShrink: 0,
            }}>
              d
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.005em" }}>doclens · ask</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--text-faint)" }}>
                HYBRID RETRIEVAL · BM25 + VECTOR
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
            {messages.length === 0 && !loading && <EmptyState />}

            {messages.map((msg, i) => (
              <div key={i} style={{ animation: "fade-in 0.2s ease" }}>
                {msg.role === "user" ? (
                  <UserBubble content={msg.content} />
                ) : msg.role === "system" ? (
                  <DocAddedBubble meta={msg.docMeta!} />
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

          {/* Input */}
          <div style={{ borderTop: "1px solid var(--border)", padding: "14px 22px", flexShrink: 0 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || loading}
                title="Add PDF to this session"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 6,
                  border: "1px solid var(--border-strong)",
                  background: uploading ? "rgba(43,127,255,0.1)" : "rgba(238,238,238,0.04)",
                  color: uploading ? "var(--accent)" : "var(--text-faint)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: uploading || loading ? "not-allowed" : "pointer",
                  flexShrink: 0,
                  transition: "border-color 150ms, color 150ms",
                }}
              >
                {uploading ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your document…"
                rows={1}
                disabled={loading}
                style={{
                  flex: 1,
                  background: "rgba(238,238,238,0.04)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  color: "var(--text)",
                  fontSize: 13.5,
                  fontFamily: "var(--font-sans)",
                  resize: "none",
                  outline: "none",
                  lineHeight: 1.5,
                  maxHeight: 120,
                  overflowY: "auto",
                  opacity: loading ? 0.5 : 1,
                  transition: "border-color 150ms",
                }}
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
              />
              <button
                onClick={submit}
                disabled={loading || !input.trim()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: loading || !input.trim() ? "rgba(238,238,238,0.05)" : "var(--accent)",
                  color: loading || !input.trim() ? "var(--text-faint)" : "#fff",
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                  fontWeight: 500,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  transition: "background 150ms, color 150ms",
                  flexShrink: 0,
                  height: 42,
                }}
              >
                {loading ? "…" : "SEND"}
              </button>
            </div>
            <p style={{ marginTop: 8, fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
              ↵ SEND · ⇧↵ NEWLINE · CLIP ADD PDF
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderBtn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{
      padding: "6px 14px",
      background: "transparent",
      border: "1px solid var(--border-mid)",
      color: "var(--text-secondary)",
      borderRadius: 999,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      letterSpacing: "0.08em",
      cursor: "pointer",
    }}>
      {children}
    </button>
  );
}

function ContextEmpty() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, opacity: 0.4 }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.2">
        <rect x="4" y="3" width="13" height="17" rx="1" />
        <rect x="7" y="6" width="13" height="17" rx="1" />
        <line x1="9" y1="9" x2="17" y2="9" />
        <line x1="9" y1="13" x2="15" y2="13" />
      </svg>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", color: "var(--text-faint)" }}>
          AWAITING QUERY
        </p>
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>
          Retrieved chunks will appear here
        </p>
      </div>
    </div>
  );
}

function ContextGroup({ group }: { group: CitationGroup }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Turn label */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", color: "var(--text-faint)", whiteSpace: "nowrap" }}>
          Q{group.msgIndex === 1 ? "1" : String(Math.ceil(group.msgIndex / 2))} ·
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {group.question.slice(0, 60)}{group.question.length > 60 ? "…" : ""}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
          {group.citations.length} SRC
        </span>
      </div>

      {group.citations.map((c, i) => (
        <ContextChunkCard key={c.chunkId} citation={c} index={i + 1} />
      ))}
    </div>
  );
}

function ContextChunkCard({ citation: c, index }: { citation: Citation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(c.score * 100);
  const scoreColor = c.score >= 0.85 ? "var(--green)" : c.score >= 0.65 ? "var(--yellow)" : "var(--red)";
  const PREVIEW_LEN = 140;
  const isLong = c.snippet.length > PREVIEW_LEN;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--accent)",
        borderRadius: "0 4px 4px 0",
        background: "rgba(43,127,255,0.03)",
        padding: "11px 13px",
        cursor: isLong ? "pointer" : "default",
        transition: "background 150ms",
      }}
      onClick={() => isLong && setExpanded(v => !v)}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
            [{index}]
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            {c.filename} · P.{c.pageNumber}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: scoreColor, fontWeight: 600 }}>
            {pct}%
          </span>
          {isLong && (
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none"
              style={{ flexShrink: 0, transition: "transform 150ms", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              <path d="M6 9l6 6 6-6" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: 2, background: "rgba(238,238,238,0.06)", borderRadius: 999, overflow: "hidden", marginBottom: 9 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: scoreColor }} />
      </div>

      {/* Snippet */}
      <p style={{ fontFamily: "var(--font-serif)", fontSize: 12, lineHeight: 1.65, color: "var(--text-secondary)", fontStyle: "italic" }}>
        &ldquo;{expanded ? c.snippet : c.snippet.slice(0, PREVIEW_LEN)}{!expanded && isLong ? "…" : ""}&rdquo;
      </p>

      {/* Expand hint */}
      {isLong && !expanded && (
        <div style={{ marginTop: 7, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--accent)", letterSpacing: "0.08em", opacity: 0.7 }}>
          CLICK TO EXPAND
        </div>
      )}

      {c.rrfScore !== undefined && expanded && (
        <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-faint)", letterSpacing: "0.06em" }}>
          RRF {c.rrfScore.toFixed(4)}
        </div>
      )}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{
        maxWidth: "86%",
        background: "var(--accent-bg)",
        border: "1px solid var(--accent-border)",
        color: "var(--text)",
        padding: "10px 14px",
        borderRadius: "12px 12px 2px 12px",
        fontSize: 13.5,
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ content, citations, latencyMs }: {
  content: string;
  citations: Citation[];
  latencyMs?: number;
}) {
  const rendered = renderCitations(content);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <span style={{
          width: 18,
          height: 18,
          borderRadius: 3,
          background: "linear-gradient(135deg, #2b7fff, #1a365d)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-serif)",
          fontSize: 10,
          color: "#ffffff",
          fontWeight: 700,
          flexShrink: 0,
        }}>
          d
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--text-faint)" }}>
          DOCLENS{latencyMs !== undefined ? ` · ${latencyMs}MS` : ""}{citations.length > 0 ? ` · ${citations.length} SOURCES` : ""}
        </span>
      </div>

      <div style={{
        background: "rgba(238,238,238,0.025)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "14px 16px",
        fontSize: 13.5,
        lineHeight: 1.7,
        color: "var(--text-secondary)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {rendered}
      </div>
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
        fontSize: "0.62em",
        color: "var(--accent)",
        background: "var(--accent-bg)",
        border: "1px solid rgba(43,127,255,0.2)",
        padding: "1px 4px",
        borderRadius: 3,
        marginLeft: 2,
        cursor: "default",
        letterSpacing: "0",
      }}>
        {part}
      </sup>
    );
  });
}

function ThinkingBubble() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{
        width: 18,
        height: 18,
        borderRadius: 3,
        background: "linear-gradient(135deg, #2b7fff, #1a365d)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-serif)",
        fontSize: 10,
        color: "#ffffff",
        fontWeight: 700,
        flexShrink: 0,
        marginTop: 2,
      }}>
        d
      </span>
      <div style={{ padding: "12px 16px", background: "rgba(238,238,238,0.025)", border: "1px solid var(--border)", borderRadius: "2px 8px 8px 8px", display: "flex", gap: 5, alignItems: "center" }}>
        {[0, 150, 300].map((delay) => (
          <div key={delay} style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--text-faint)",
            animation: `pulse-dot 1.2s ease-in-out ${delay}ms infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      padding: "10px 14px",
      borderRadius: 4,
      border: "1px solid rgba(248,113,113,0.25)",
      background: "rgba(248,113,113,0.05)",
      color: "var(--red)",
      fontSize: 12.5,
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.04em",
    }}>
      ERROR · {message}
    </div>
  );
}

function DocAddedBubble({ meta }: { meta: { filename: string; chunkCount: number; pageCount?: number } }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        border: "1px solid rgba(43,127,255,0.2)",
        borderRadius: 999,
        background: "rgba(43,127,255,0.06)",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
          {meta.filename}
        </span>
        <span style={{ width: 1, height: 10, background: "var(--border-strong)" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.08em" }}>
          {meta.chunkCount} CHUNKS{meta.pageCount ? ` · ${meta.pageCount}P` : ""}
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "60px 0", opacity: 0.5 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.3">
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", color: "var(--text-faint)" }}>
          ASK ANYTHING
        </p>
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>
          Answers include cited sources with relevance scores
        </p>
      </div>
    </div>
  );
}
