"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface ChunkRow {
  chunkIndex: number;
  pageNumber: number;
  charOffset: number;
  tokenCount: number | null;
  chars: number;
  content: string;
}

interface UploadState {
  status: "idle" | "uploading" | "done" | "error";
  filename?: string;
  pageCount?: number;
  chunkCount?: number;
  error?: string;
}

interface EmbedResult {
  model: string;
  dim: number;
  preview: number[];
  latencyMs: number;
}

interface EmbedState {
  status: "idle" | "loading" | "done" | "error";
  result?: EmbedResult;
  error?: string;
}

interface IngestState {
  status: "idle" | "ingesting" | "done" | "error";
  filename?: string;
  sessionId?: string;
  documentId?: string;
  pageCount?: number;
  chunkCount?: number;
  error?: string;
}

export default function Home() {
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [chunks, setChunks] = useState<ChunkRow[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [embedText, setEmbedText] = useState("");
  const [embed, setEmbed] = useState<EmbedState>({ status: "idle" });
  const [ingest, setIngest] = useState<IngestState>({ status: "idle" });

  const onDropIngest = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setIngest({ status: "ingesting", filename: file.name });

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setIngest({ status: "error", filename: file.name, error: json.error ?? "Upload failed" });
        return;
      }
      const { sessionId, documentId, pageCount, chunkCount } = json.data;
      setIngest({ status: "done", filename: file.name, sessionId, documentId, pageCount, chunkCount });
    } catch (err) {
      setIngest({ status: "error", filename: file.name, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }, []);

  const { getRootProps: getIngestRootProps, getInputProps: getIngestInputProps, isDragActive: isIngestDragActive } = useDropzone({
    onDrop: onDropIngest,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: ingest.status === "ingesting",
  });

  async function testEmbed() {
    if (!embedText.trim()) return;
    setEmbed({ status: "loading" });
    try {
      const res = await fetch("/api/embed-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: embedText }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setEmbed({ status: "error", error: json.error ?? "Request failed" });
        return;
      }
      setEmbed({ status: "done", result: json.data });
    } catch (err) {
      setEmbed({ status: "error", error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;

    setUpload({ status: "uploading", filename: file.name });
    setChunks([]);
    setExpanded(new Set());

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/chunk-preview", { method: "POST", body: form });
    const json = await res.json();

    if (!res.ok || !json.success) {
      setUpload({ status: "error", filename: file.name, error: json.error ?? "Failed" });
      return;
    }

    const { filename, pageCount, chunkCount, chunks: rows } = json.data;
    setUpload({ status: "done", filename, pageCount, chunkCount });
    setChunks(rows);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: upload.status === "uploading",
  });

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const avgTokens = chunks.length
    ? Math.round(chunks.reduce((s, c) => s + (c.tokenCount ?? 0), 0) / chunks.length)
    : 0;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-4xl mx-auto px-6 py-16">

        <div className="mb-14">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }} />
            <span style={{ color: "var(--text-muted)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
              DocLens
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--text)" }}>
            Inspect your PDF<br />
            <span style={{ color: "var(--text-muted)" }}>chunk by chunk.</span>
          </h1>
          <p style={{ marginTop: 16, color: "var(--text-muted)", fontSize: 15, maxWidth: 480, lineHeight: 1.6 }}>
            Upload a PDF to see how it gets split into retrieval chunks — page boundaries, token counts, and overlap.
          </p>
        </div>

        <div
          {...getRootProps()}
          style={{
            border: `1.5px dashed ${isDragActive ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 12,
            background: isDragActive ? "var(--accent-glow)" : "var(--surface)",
            padding: "48px 32px",
            textAlign: "center",
            cursor: upload.status === "uploading" ? "not-allowed" : "pointer",
            transition: "border-color 150ms, background 150ms",
            outline: "none",
          }}
        >
          <input {...getInputProps()} />
          {upload.status === "uploading" ? (
            <div>
              <Spinner />
              <p style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 14 }}>
                Chunking <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{upload.filename}</span>…
              </p>
            </div>
          ) : (
            <div>
              <UploadIcon active={isDragActive} />
              <p style={{ marginTop: 12, color: "var(--text)", fontSize: 15, fontWeight: 500 }}>
                {isDragActive ? "Drop to upload" : "Drop a PDF here"}
              </p>
              <p style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 13 }}>or click to browse</p>
            </div>
          )}
        </div>

        {upload.status === "error" && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)", color: "var(--red)", fontSize: 14 }}>
            {upload.error}
          </div>
        )}

        {upload.status === "done" && (
          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Stat label="File" value={upload.filename ?? ""} mono />
            <Stat label="Pages" value={String(upload.pageCount ?? "—")} />
            <Stat label="Chunks" value={String(upload.chunkCount ?? "—")} />
            <Stat label="Avg tokens" value={String(avgTokens)} />
            <Stat label="Max chars" value={String(Math.max(...chunks.map(c => c.chars)))} />
          </div>
        )}

        {chunks.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
              {chunks.length} CHUNKS
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {chunks.map((chunk) => {
                const isOpen = expanded.has(chunk.chunkIndex);
                return (
                  <div
                    key={chunk.chunkIndex}
                    onClick={() => toggle(chunk.chunkIndex)}
                    style={{
                      border: `1px solid ${isOpen ? "var(--accent-dim)" : "var(--border-subtle)"}`,
                      borderRadius: 8,
                      background: isOpen ? "rgba(124,106,247,0.04)" : "var(--surface)",
                      cursor: "pointer",
                      transition: "border-color 100ms, background 100ms",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", minWidth: 36 }}>
                        #{chunk.chunkIndex}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", background: "var(--surface-2)", padding: "2px 7px", borderRadius: 4 }}>
                        p.{chunk.pageNumber}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                        {chunk.chars}ch
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                        ~{chunk.tokenCount ?? "?"}tok
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {chunk.content.slice(0, 100)}
                      </span>
                      <Chevron open={isOpen} />
                    </div>

                    {isOpen && (
                      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 14px 14px 36px" }}>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {chunk.content}
                        </p>
                        <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                          charOffset: {chunk.charOffset} · chars: {chunk.chars}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Full ingest pipeline test */}
        <div style={{ marginTop: 56, borderTop: "1px solid var(--border-subtle)", paddingTop: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ color: "var(--text-muted)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
              Full Pipeline — Upload → Chunk → Embed → Store
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            Runs the real ingestion: parses PDF, chunks, embeds with NVIDIA, stores in Neon DB with pgvector.
          </p>

          <div
            {...getIngestRootProps()}
            style={{
              border: `1.5px dashed ${isIngestDragActive ? "#22c55e" : "var(--border)"}`,
              borderRadius: 10,
              background: isIngestDragActive ? "rgba(34,197,94,0.05)" : "var(--surface)",
              padding: "32px 24px",
              textAlign: "center",
              cursor: ingest.status === "ingesting" ? "not-allowed" : "pointer",
              transition: "border-color 150ms, background 150ms",
              outline: "none",
            }}
          >
            <input {...getIngestInputProps()} />
            {ingest.status === "ingesting" ? (
              <div>
                <Spinner />
                <p style={{ marginTop: 10, color: "var(--text-muted)", fontSize: 13 }}>
                  Ingesting <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{ingest.filename}</span>…
                </p>
                <p style={{ marginTop: 4, color: "var(--text-dim)", fontSize: 12 }}>parsing → chunking → embedding → storing</p>
              </div>
            ) : (
              <div>
                <p style={{ color: "var(--text)", fontSize: 14, fontWeight: 500 }}>
                  {isIngestDragActive ? "Drop to ingest" : "Drop a PDF to ingest"}
                </p>
                <p style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 12 }}>stores chunks + embeddings in DB</p>
              </div>
            )}
          </div>

          {ingest.status === "error" && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)", color: "var(--red)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
              {ingest.error}
            </div>
          )}

          {ingest.status === "done" && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <Stat label="File" value={ingest.filename ?? ""} mono />
                <Stat label="Pages" value={String(ingest.pageCount ?? "—")} />
                <Stat label="Chunks stored" value={String(ingest.chunkCount ?? "—")} />
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.05)" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#22c55e", marginBottom: 6 }}>✓ Ingestion complete</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                  sessionId: {ingest.sessionId}
                </p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                  documentId: {ingest.documentId}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Embedding test panel */}
        <div style={{ marginTop: 56, borderTop: "1px solid var(--border-subtle)", paddingTop: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
            <span style={{ color: "var(--text-muted)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
              Embedding Test
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            Send text to NVIDIA embedding API — verify model responds and check output dimension.
          </p>

          <textarea
            value={embedText}
            onChange={(e) => setEmbedText(e.target.value)}
            placeholder="Type any text to embed…"
            rows={3}
            style={{
              width: "100%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <button
            onClick={testEmbed}
            disabled={embed.status === "loading" || !embedText.trim()}
            style={{
              marginTop: 10,
              padding: "8px 20px",
              borderRadius: 7,
              border: "none",
              background: embed.status === "loading" ? "var(--surface-2)" : "var(--accent)",
              color: embed.status === "loading" ? "var(--text-muted)" : "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: embed.status === "loading" || !embedText.trim() ? "not-allowed" : "pointer",
              transition: "background 150ms",
            }}
          >
            {embed.status === "loading" ? "Embedding…" : "Test Embed"}
          </button>

          {embed.status === "error" && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)", color: "var(--red)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
              {embed.error}
            </div>
          )}

          {embed.status === "done" && embed.result && (
            <div style={{ marginTop: 14, padding: "16px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <Stat label="Model" value={embed.result.model} mono />
                <Stat label="Dimension" value={String(embed.result.dim)} />
                <Stat label="Latency" value={`${embed.result.latencyMs}ms`} />
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                FIRST 8 VALUES
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {embed.result.preview.map((v, i) => (
                  <div key={i} style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "4px 8px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>{i}: </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: v >= 0 ? "var(--accent)" : "var(--red)" }}>
                      {v.toFixed(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 14px" }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, fontFamily: mono ? "var(--font-mono)" : undefined, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </p>
    </div>
  );
}

function UploadIcon({ active }: { active: boolean }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto", display: "block" }}>
      <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke={active ? "var(--accent)" : "var(--text-muted)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16v1a4 4 0 004 4h10a4 4 0 004-4v-1" stroke={active ? "var(--accent)" : "var(--border)"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <div style={{ width: 20, height: 20, margin: "0 auto", border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transition: "transform 150ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
      <path d="M6 9l6 6 6-6" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
