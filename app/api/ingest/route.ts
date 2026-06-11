import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chunkDocument } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";

interface PDFPageResult {
  text: string;
  num: number;
}

interface PDFTextResult {
  pages: PDFPageResult[];
  text: string;
  total: number;
}

interface PDFParseInstance {
  load(): Promise<{ numPages: number }>;
  getText(opts: { pages: number[] }): Promise<PDFTextResult>;
}

interface PDFParseModule {
  PDFParse: new (opts: { data: Buffer }) => PDFParseInstance;
}

export async function POST(req: NextRequest) {
  const { documentId, buffer: bufferArray } = await req.json();

  if (!documentId || !bufferArray) {
    return NextResponse.json(
      { success: false, error: "documentId and buffer required" },
      { status: 400 }
    );
  }

  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) {
    return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
  }

  const buffer = Buffer.from(bufferArray);
  const { PDFParse } = await import("pdf-parse") as unknown as PDFParseModule;

  const parser = new PDFParse({ data: buffer });
  const doc = await parser.load();
  const totalPages = doc.numPages;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const result = await parser.getText({ pages: pageNumbers });

  const pages = result.pages.map((p) => ({
    text: p.text,
    pageNumber: p.num,
  }));

  const chunks = chunkDocument(pages, document.filename);

  if (chunks.length === 0) {
    return NextResponse.json({ success: false, error: "No text extracted from PDF" }, { status: 422 });
  }

  const texts = chunks.map((c) => c.content);
  const embeddings = await embedTexts(texts);

  const startTime = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];

    const created = await db.chunk.create({
      data: {
        documentId,
        content: chunk.content,
        pageNumber: chunk.metadata.pageNumber,
        chunkIndex: chunk.metadata.chunkIndex,
        charOffset: chunk.metadata.charOffset,
        tokenCount: chunk.metadata.tokenCount,
      },
    });

    await db.$executeRaw`
      UPDATE "Chunk"
      SET embedding = ${JSON.stringify(embedding)}::vector
      WHERE id = ${created.id}
    `;
  }

  if (!document.pageCount) {
    await db.document.update({
      where: { id: documentId },
      data: { pageCount: totalPages },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      chunkCount: chunks.length,
      embeddingDurationMs: Date.now() - startTime,
    },
  });
}
