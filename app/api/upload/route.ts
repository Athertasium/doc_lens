import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
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
    const { PDFParse } = await import("pdf-parse") as unknown as {
      PDFParse: new (opts: { data: Buffer }) => { load(): Promise<{ numPages: number }> };
    };
    const parser = new PDFParse({ data: buffer });
    const doc = await parser.load();
    pageCount = doc.numPages;
  } catch {
    // non-fatal
  }

  const existingSessionId = (formData.get("sessionId") as string | null)?.trim() || null;
  const sessionId = existingSessionId ?? crypto.randomUUID();

  const document = await db.document.create({
    data: {
      filename: file.name,
      fileSize: file.size,
      pageCount,
      sessionId,
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
