"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

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
  const [ingest, setIngest] = useState<IngestState>({ status: "idle" });

  const onDrop = useCallback(async (accepted: File[]) => {
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: ingest.status === "ingesting",
  });

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto px-6 py-20">

        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }} />
            <span style={{ color: "var(--text-muted)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
              DocLens
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--text)" }}>
            Ask your documents.<br />
            <span style={{ color: "var(--text-muted)" }}>Get cited answers.</span>
          </h1>
          <p style={{ marginTop: 14, color: "var(--text-muted)", fontSize: 15, maxWidth: 420, lineHeight: 1.6 }}>
            Upload a PDF — DocLens chunks, embeds, and indexes it. Then ask anything and get answers with numbered citations linking back to exact pages.
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
            cursor: ingest.status === "ingesting" ? "not-allowed" : "pointer",
            transition: "border-color 150ms, background 150ms",
            outline: "none",
          }}
        >
          <input {...getInputProps()} />
          {ingest.status === "ingesting" ? (
            <div>
              <Spinner />
              <p style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 14 }}>
                Processing <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{ingest.filename}</span>…
              </p>
              <p style={{ marginTop: 4, color: "var(--text-dim)", fontSize: 12 }}>parsing → chunking → embedding → storing</p>
            </div>
          ) : (
            <div>
              <UploadIcon active={isDragActive} />
              <p style={{ marginTop: 12, color: "var(--text)", fontSize: 15, fontWeight: 500 }}>
                {isDragActive ? "Drop to upload" : "Drop a PDF here"}
              </p>
              <p style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 13 }}>or click to browse · PDF only</p>
            </div>
          )}
        </div>

        {ingest.status === "error" && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)", color: "var(--red)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
            {ingest.error}
          </div>
        )}

        {ingest.status === "done" && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <Stat label="File" value={ingest.filename ?? ""} mono />
              <Stat label="Pages" value={String(ingest.pageCount ?? "—")} />
              <Stat label="Chunks stored" value={String(ingest.chunkCount ?? "—")} />
            </div>
            <Link
              href={`/chat/${ingest.sessionId}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 8,
                background: "var(--accent)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Start chatting
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        )}

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
