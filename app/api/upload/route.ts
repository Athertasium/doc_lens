import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingestDocument } from "@/lib/ingest";

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
  const buffer = new Uint8Array(bytes);

  const existingSessionId = (formData.get("sessionId") as string | null)?.trim() || null;
  const sessionId = existingSessionId ?? crypto.randomUUID();

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
      pageCount: null,
      sessionId,
      userId,
    },
  });

  try {
    const result = await ingestDocument(document.id, buffer);

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        documentId: document.id,
        pageCount: result.totalPages,
        chunkCount: result.chunkCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
