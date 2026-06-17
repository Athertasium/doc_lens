import { NextRequest, NextResponse } from "next/server";
import { ingestDocument } from "@/lib/ingest";

export async function POST(req: NextRequest) {
  const { documentId, buffer: bufferArray } = await req.json();

  if (!documentId || !bufferArray) {
    return NextResponse.json(
      { success: false, error: "documentId and buffer required" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.isBuffer(bufferArray)
      ? bufferArray
      : Buffer.from(bufferArray);

    const result = await ingestDocument(documentId, new Uint8Array(buffer));

    return NextResponse.json({
      success: true,
      data: {
        chunkCount: result.chunkCount,
        embeddingDurationMs: result.embeddingDurationMs,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    const status = message === "Document not found" ? 404 : message === "No text extracted from PDF" ? 422 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
