import { NextRequest, NextResponse } from "next/server";
import { getDocumentProxy } from "unpdf";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ success: false, error: "Only PDF files accepted" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let pageCount: number | null = null;
  try {
    const pdfDoc = await getDocumentProxy(new Uint8Array(buffer));
    pageCount = pdfDoc.numPages;
  } catch {
    // non-fatal
  }

  const existingSessionId = (formData.get("sessionId") as string | null)?.trim() || null;
  const sessionId = existingSessionId ?? crypto.randomUUID();

  // Upsert ChatSession — creates on first upload, updates title/updatedAt on subsequent
  if (userId) {
    const existing = await db.chatSession.findUnique({ where: { id: sessionId } });
    if (!existing) {
      await db.chatSession.create({
        data: {
          id: sessionId,
          userId,
          title: file.name.replace(/\.pdf$/i, ""),
        },
      });
    } else {
      await db.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    }
  }

  const document = await db.document.create({
    data: {
      filename: file.name,
      fileSize: file.size,
      pageCount,
      sessionId,
      userId,
    },
  });

  const ingestRes = await fetch(new URL("/api/ingest", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId: document.id, buffer: Array.from(buffer) }),
  });

  if (!ingestRes.ok) {
    const err = await ingestRes.json().catch(() => ({ error: "Ingest failed" }));
    return NextResponse.json(
      { success: false, error: err.error ?? "Ingestion failed" },
      { status: 500 }
    );
  }

  const ingestData = await ingestRes.json();

  return NextResponse.json({
    success: true,
    data: {
      sessionId,
      documentId: document.id,
      pageCount,
      chunkCount: ingestData.data?.chunkCount,
    },
  });
}
