import { NextRequest, NextResponse } from "next/server";
import { chunkDocument } from "@/lib/chunker";
import type { TextChunk } from "@/lib/types";

interface PDFPageResult { text: string; num: number; }
interface PDFParseInstance {
  load(): Promise<{ numPages: number }>;
  getText(opts: { pages: number[] }): Promise<{ pages: PDFPageResult[] }>;
}
interface PDFParseModule {
  PDFParse: new (opts: { data: Buffer }) => PDFParseInstance;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ success: false, error: "Only PDF files accepted" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { PDFParse } = await import("pdf-parse") as unknown as PDFParseModule;

  const parser = new PDFParse({ data: buffer });
  const doc = await parser.load();
  const totalPages = doc.numPages;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const result = await parser.getText({ pages: pageNumbers });

  const pages = result.pages.map((p) => ({ text: p.text, pageNumber: p.num }));
  const chunks: TextChunk[] = chunkDocument(pages, file.name);

  return NextResponse.json({
    success: true,
    data: {
      filename: file.name,
      pageCount: totalPages,
      chunkCount: chunks.length,
      chunks: chunks.map((c) => ({
        chunkIndex: c.metadata.chunkIndex,
        pageNumber: c.metadata.pageNumber,
        charOffset: c.metadata.charOffset,
        tokenCount: c.metadata.tokenCount,
        chars: c.content.length,
        content: c.content,
      })),
    },
  });
}
