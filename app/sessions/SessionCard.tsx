"use client";

import Link from "next/link";
import { useState } from "react";

interface SessionCardProps {
  id: string;
  title: string | null;
  docCount: number;
  queryCount: number;
  lastQuestion: string | null;
  updatedLabel: string;
}

export default function SessionCard({ id, title, docCount, queryCount, lastQuestion, updatedLabel }: SessionCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={`/chat/${id}`} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? "rgba(43,127,255,0.03)" : "var(--bg-app)",
          border: `1px solid ${hovered ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 8,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          cursor: "pointer",
          transition: "border-color 150ms, background 150ms",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 14.5, color: "var(--text)", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title ?? "Untitled session"}
          </div>
          {lastQuestion && (
            <div style={{ fontSize: 12, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {lastQuestion.slice(0, 80)}{lastQuestion.length > 80 ? "…" : ""}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.08em" }}>
              {docCount} DOC{docCount !== 1 ? "S" : ""} · {queryCount} MSG{queryCount !== 1 ? "S" : ""}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-faint)", letterSpacing: "0.06em", marginTop: 3 }}>
              {updatedLabel}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
