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

export default function UploadPage() {
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
          ? { ...prev, files: prev.files.map((f, idx) => idx === i ? { ...f, status: "ingesting" } : f) }
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
              ? { ...prev, files: prev.files.map((f, idx) => idx === i ? { ...f, status: "error", error: json.error ?? "Upload failed" } : f) }
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

  const isProcessing = globalStatus === "processing";
  const isDone = globalStatus === "done";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: "1px solid var(--border)",
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <DocLensLogo />
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/sessions" style={{
            padding: "5px 14px",
            border: "1px solid var(--border-strong)",
            borderRadius: 999,
            color: "var(--text-dim)",
            letterSpacing: "0.06em",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            textDecoration: "none",
          }}>
            SESSIONS
          </Link>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: 680, width: "100%", margin: "0 auto", padding: "0 32px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 32, paddingTop: 64, paddingBottom: 80 }}>

        {/* Hero */}
        <div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.16em",
            color: "var(--accent)",
            marginBottom: 16,
            textTransform: "uppercase",
          }}>
            READ WHAT&apos;S ACTUALLY IN THE DOCUMENT
          </div>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            color: "var(--text)",
            margin: 0,
          }}>
            Drop a PDF. Ask anything.<br />
            <span style={{ color: "var(--text-dim)" }}>Every answer is a clickable receipt.</span>
          </h1>
        </div>

        {/* Drop zone or processing */}
        {!isProcessing && !isDone && (
          <div
            {...getRootProps()}
            style={{
              border: `1px dashed ${isDragActive ? "var(--accent)" : "rgba(43,127,255,0.35)"}`,
              borderRadius: 8,
              padding: "36px 32px",
              textAlign: "center",
              cursor: "pointer",
              background: isDragActive ? "rgba(43,127,255,0.06)" : "rgba(43,127,255,0.02)",
              transition: "border-color 150ms, background 150ms",
              outline: "none",
            }}
          >
            <input {...getInputProps()} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" style={{ margin: "0 auto 14px", display: "block" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m17 8-5-5-5 5" />
              <path d="M12 3v12" />
            </svg>
            <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 500 }}>
              {isDragActive ? "Drop to upload" : "Drop PDF here"}
            </div>
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--text-faint)" }}>
              OR <span style={{ color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: 3 }}>BROWSE FILES</span>
              {" "}· MAX 50MB · PDF ONLY · MULTI-DOC SUPPORTED
            </div>
          </div>
        )}

        {isProcessing && session && (
          <ProcessingPanel files={session.files} />
        )}

        {isDone && session?.sessionId && (
          <DonePanel session={session} onReset={reset} />
        )}

      </main>

      {/* Footer */}
      <footer style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "14px 32px",
        borderTop: "1px solid var(--border)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.12em",
        color: "var(--text-faint)",
      }}>
        <span>HYBRID RETRIEVAL · PGVECTOR + BM25 · RRF MERGE</span>
        <span>V5 · GROQ LLAMA-3.3-70B</span>
      </footer>
    </div>
  );
}

function DocLensLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5">
        <rect x="4" y="3" width="13" height="17" rx="1" />
        <rect x="7" y="6" width="13" height="17" rx="1" fill="var(--bg)" />
      </svg>
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, letterSpacing: "-0.01em", color: "var(--text)" }}>
        doclens
      </span>
    </div>
  );
}

function ProcessingPanel({ files }: { files: FileStatus[] }) {
  const currentFile = files.find(f => f.status === "ingesting") ?? files[files.length - 1];
  const doneCount = files.filter(f => f.status === "done").length;

  const steps = [
    { label: "Extracting text", done: doneCount > 0, active: false },
    { label: "Detecting structure", done: doneCount > 0, active: false },
    { label: "Embedding chunks", done: false, active: true, progress: 0.6 },
    { label: "Building retrieval index", done: false, active: false, queued: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "var(--text-faint)" }}>
          PROCESSING
        </div>
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400, letterSpacing: "-0.02em", color: "var(--text)", margin: "10px 0 6px" }}>
          {currentFile?.filename ?? "…"}
        </h3>
        {files.length > 1 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.04em" }}>
            {doneCount} / {files.length} files complete
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {steps.map((step, i) => (
          <div key={i}>
            <div style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 16, alignItems: "center", opacity: step.queued ? 0.4 : 1 }}>
              {step.done ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.2">
                  <path d="m5 12 5 5L20 7" />
                </svg>
              ) : step.active ? (
                <span style={{ width: 14, height: 14, border: "2px solid rgba(43,127,255,0.25)", borderTopColor: "var(--accent)", borderRadius: "50%", display: "inline-block", animation: "spin 800ms linear infinite" }} />
              ) : (
                <span style={{ width: 6, height: 6, background: "var(--text-faint)", borderRadius: "50%", marginLeft: 5 }} />
              )}
              <span style={{ fontSize: 13.5, color: step.active ? "var(--text)" : step.done ? "var(--text-secondary)" : "var(--text-dim)", fontWeight: step.active ? 500 : 400 }}>
                {step.label}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: step.active ? "var(--accent)" : "var(--text-faint)" }}>
                {step.queued ? "QUEUED" : step.done ? "✓" : step.active ? `${Math.round((step.progress ?? 0) * 100)}%` : ""}
              </span>
            </div>
            {step.active && (
              <div style={{ marginTop: 10, marginLeft: 36, height: 3, background: "rgba(238,238,238,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${(step.progress ?? 0) * 100}%`, height: "100%", background: "var(--accent)", transition: "width 400ms ease" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--text-faint)", marginBottom: 10 }}>
          QUEUE · {files.length} FILE{files.length > 1 ? "S" : ""}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "9px 12px",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontSize: 12.5,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StatusDot status={f.status} />
                <span style={{ fontFamily: "var(--font-mono)", color: f.status === "ingesting" ? "var(--text)" : "var(--text-secondary)" }}>
                  {f.filename}
                </span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>
                {f.status === "done" ? `${f.pageCount}p · ${f.chunkCount} chunks` :
                 f.status === "ingesting" ? "PROCESSING" :
                 f.status === "error" ? f.error :
                 "QUEUED"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DonePanel({ session, onReset }: { session: SessionState; onReset: () => void }) {
  const doneFiles = session.files.filter(f => f.status === "done");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fade-in 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 6, height: 6, background: "var(--green)", borderRadius: "50%", boxShadow: "0 0 8px var(--green-glow)", animation: "glow-pulse 2s ease infinite" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "var(--green)" }}>
          INDEXED · READY TO QUERY
        </span>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <StatCard label="DOCUMENTS" value={String(doneFiles.length)} />
        <StatCard label="TOTAL PAGES" value={String(session.totalPages || "—")} />
        <StatCard label="CHUNKS" value={String(session.totalChunks || "—")} />
        <StatCard label="SESSION" value={session.sessionId.slice(0, 8).toUpperCase()} mono />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {session.files.map((f, i) => (
          <div key={i} style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 12px",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusDot status={f.status} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: f.status === "error" ? "var(--text-dim)" : "var(--text-secondary)" }}>
                {f.filename}
              </span>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>
              {f.status === "done" ? `${f.pageCount}p · ${f.chunkCount} chunks` : f.error ?? ""}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Link
          href={`/chat/${session.sessionId}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 20px",
            borderRadius: 999,
            background: "var(--text)",
            color: "#0a0a0c",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
            textDecoration: "none",
          }}
        >
          START QUERYING
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <button
          onClick={onReset}
          style={{
            padding: "9px 20px",
            borderRadius: 999,
            border: "1px solid var(--border-strong)",
            background: "transparent",
            color: "var(--text-dim)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
            cursor: "pointer",
          }}
        >
          NEW SESSION
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      flex: 1,
      border: "1px solid var(--border)",
      borderRadius: 4,
      padding: "10px 14px",
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", color: "var(--text-faint)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: mono ? "var(--font-mono)" : undefined, fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: FileStatus["status"] }) {
  const colors: Record<FileStatus["status"], string> = {
    pending: "var(--text-faint)",
    ingesting: "var(--accent)",
    done: "var(--green)",
    error: "var(--red)",
  };
  const glow: Partial<Record<FileStatus["status"], string>> = {
    ingesting: "0 0 6px var(--accent)",
    done: "0 0 6px rgba(74,222,128,0.6)",
  };
  return (
    <span style={{
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: colors[status],
      flexShrink: 0,
      boxShadow: glow[status],
    }} />
  );
}
