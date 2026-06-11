"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface FileStatus {
  filename: string;
  status: "pending" | "ingesting" | "done" | "error";
  pageCount?: number;
  chunkCount?: number;
  error?: string;
}

interface SessionState {
  sessionId: string;
  files: FileStatus[];
  totalPages: number;
  totalChunks: number;
}

export default function Home() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [globalStatus, setGlobalStatus] = useState<"idle" | "processing" | "done" | "error">("idle");

  const processFiles = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    setGlobalStatus("processing");

    const initialFiles: FileStatus[] = accepted.map((f) => ({
      filename: f.name,
      status: "pending",
    }));

    let sessionId: string | null = null;
    let totalPages = 0;
    let totalChunks = 0;

    setSession({ sessionId: "", files: initialFiles, totalPages: 0, totalChunks: 0 });

    for (let i = 0; i < accepted.length; i++) {
      const file = accepted[i];

      setSession((prev) =>
        prev
          ? {
              ...prev,
              files: prev.files.map((f, idx) =>
                idx === i ? { ...f, status: "ingesting" } : f
              ),
            }
          : prev
      );

      const form = new FormData();
      form.append("file", file);
      if (sessionId) form.append("sessionId", sessionId);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const json = await res.json();

        if (!res.ok || !json.success) {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  files: prev.files.map((f, idx) =>
                    idx === i ? { ...f, status: "error", error: json.error ?? "Upload failed" } : f
                  ),
                }
              : prev
          );
          continue;
        }

        const { sessionId: returnedId, pageCount, chunkCount } = json.data;
        if (!sessionId) sessionId = returnedId;

        totalPages += pageCount ?? 0;
        totalChunks += chunkCount ?? 0;

        setSession((prev) =>
          prev
            ? {
                ...prev,
                sessionId: sessionId!,
                totalPages,
                totalChunks,
                files: prev.files.map((f, idx) =>
                  idx === i ? { ...f, status: "done", pageCount, chunkCount } : f
                ),
              }
            : prev
        );
      } catch (err) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                files: prev.files.map((f, idx) =>
                  idx === i
                    ? { ...f, status: "error", error: err instanceof Error ? err.message : "Unknown error" }
                    : f
                ),
              }
            : prev
        );
      }
    }

    setGlobalStatus("done");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processFiles,
    accept: { "application/pdf": [".pdf"] },
    disabled: globalStatus === "processing",
    multiple: true,
  });

  const reset = () => {
    setSession(null);
    setGlobalStatus("idle");
  };

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
            Upload one or more PDFs — DocLens chunks, embeds, and indexes them. Ask anything and get answers with numbered citations linking back to exact pages.
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
            cursor: globalStatus === "processing" ? "not-allowed" : "pointer",
            transition: "border-color 150ms, background 150ms",
            outline: "none",
          }}
        >
          <input {...getInputProps()} />
          {globalStatus === "processing" ? (
            <div>
              <Spinner />
              <p style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 14 }}>
                Processing files…
              </p>
              <p style={{ marginTop: 4, color: "var(--text-dim)", fontSize: 12 }}>parsing → chunking → embedding → storing</p>
            </div>
          ) : (
            <div>
              <UploadIcon active={isDragActive} />
              <p style={{ marginTop: 12, color: "var(--text)", fontSize: 15, fontWeight: 500 }}>
                {isDragActive ? "Drop to upload" : "Drop PDFs here"}
              </p>
              <p style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 13 }}>or click to browse · multiple PDFs supported</p>
            </div>
          )}
        </div>

        {session && session.files.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <FileList files={session.files} />
          </div>
        )}

        {globalStatus === "done" && session?.sessionId && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <Stat label="Documents" value={String(session.files.filter((f) => f.status === "done").length)} />
              <Stat label="Total pages" value={String(session.totalPages || "—")} />
              <Stat label="Chunks stored" value={String(session.totalChunks || "—")} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href={`/chat/${session.sessionId}`}
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

              <button
                onClick={reset}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Upload more
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

function FileList({ files }: { files: FileStatus[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {files.map((f, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <StatusDot status={f.status} />
          <span style={{ flex: 1, fontSize: 13, color: "var(--text)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {f.filename}
          </span>
          {f.status === "done" && f.pageCount !== undefined && (
            <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {f.pageCount}p · {f.chunkCount} chunks
            </span>
          )}
          {f.status === "error" && (
            <span style={{ fontSize: 12, color: "var(--red)", whiteSpace: "nowrap" }}>{f.error}</span>
          )}
          {f.status === "ingesting" && <MiniSpinner />}
        </div>
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: FileStatus["status"] }) {
  const colors: Record<FileStatus["status"], string> = {
    pending: "var(--border)",
    ingesting: "var(--accent)",
    done: "#4ade80",
    error: "var(--red)",
  };
  return (
    <div style={{ width: 7, height: 7, borderRadius: "50%", background: colors[status], flexShrink: 0 }} />
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 14px" }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, fontFamily: mono ? "var(--font-mono)" : undefined }}>
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

function MiniSpinner() {
  return (
    <div style={{ width: 14, height: 14, border: "1.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
  );
}
