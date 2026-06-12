import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOutButton from "./SignOutButton";
import SessionCard from "./SessionCard";

async function getSessionsForUser(userId: string) {
  const sessions = await db.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  const enriched = await Promise.all(
    sessions.map(async (s) => {
      const [docCount, queryCount, lastQuery] = await Promise.all([
        db.document.count({ where: { sessionId: s.id } }),
        db.queryLog.count({ where: { sessionId: s.id } }),
        db.queryLog.findFirst({
          where: { sessionId: s.id },
          orderBy: { createdAt: "desc" },
          select: { question: true, createdAt: true },
        }),
      ]);
      return { ...s, docCount, queryCount, lastQuery };
    })
  );

  return enriched;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function SessionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id: string }).id;
  const sessions = await getSessionsForUser(userId);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        borderBottom: "1px solid var(--border)",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5">
            <rect x="4" y="3" width="13" height="17" rx="1" />
            <rect x="7" y="6" width="13" height="17" rx="1" fill="var(--bg)" />
          </svg>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, letterSpacing: "-0.01em", color: "var(--text)" }}>
            doclens
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-faint)", letterSpacing: "0.08em" }}>
            {session.user.email}
          </span>
          <SignOutButton />
          <Link
            href="/"
            style={{
              padding: "6px 14px",
              background: "var(--accent)",
              border: "none",
              color: "#fff",
              borderRadius: 999,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.08em",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            NEW SESSION
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text)", marginBottom: 4 }}>
            Sessions
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", color: "var(--text-faint)" }}>
            {sessions.length} SESSION{sessions.length !== 1 ? "S" : ""}
          </p>
        </div>

        {sessions.length === 0 ? (
          <div style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: 8,
            padding: "60px 0",
            textAlign: "center",
            opacity: 0.5,
          }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", color: "var(--text-faint)" }}>
              NO SESSIONS YET
            </p>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>
              Upload a PDF to start your first session
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                id={s.id}
                title={s.title}
                docCount={s.docCount}
                queryCount={s.queryCount}
                lastQuestion={s.lastQuery?.question ?? null}
                updatedLabel={formatDate(s.updatedAt)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
