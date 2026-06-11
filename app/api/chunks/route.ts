import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const documentId = req.nextUrl.searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ success: false, error: "documentId required" }, { status: 400 });
  }

  const chunks = await db.chunk.findMany({
    where: { documentId },
    orderBy: { chunkIndex: "asc" },
    select: {
      id: true,
      chunkIndex: true,
      pageNumber: true,
      charOffset: true,
      tokenCount: true,
      content: true,
    },
  });

  return NextResponse.json({ success: true, data: chunks });
}
