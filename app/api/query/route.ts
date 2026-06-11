import { NextRequest, NextResponse } from "next/server";
import { embedQuery } from "@/lib/embeddings";
import { denseRetrieve } from "@/lib/retrieval";
import { generateAnswer } from "@/lib/generator";
import { db } from "@/lib/db";
import { ApiResponse, QueryResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question, sessionId } = body as { question?: string; sessionId?: string };

  if (!question?.trim() || !sessionId?.trim()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "question and sessionId required" },
      { status: 400 }
    );
  }

  const start = Date.now();

  const queryEmbedding = await embedQuery(question);
  const chunks = await denseRetrieve(queryEmbedding, sessionId, 10);

  if (chunks.length === 0) {
    return NextResponse.json<ApiResponse<QueryResult>>({
      success: true,
      data: {
        answer: "The provided documents don't contain enough information to answer this question.",
        citations: [],
        latencyMs: Date.now() - start,
      },
    });
  }

  const { answer, citations } = await generateAnswer(question, chunks);
  const latencyMs = Date.now() - start;

  await db.queryLog.create({
    data: {
      sessionId,
      question,
      answer,
      citedChunks: citations as object[],
      latencyMs,
    },
  });

  return NextResponse.json<ApiResponse<QueryResult>>({
    success: true,
    data: { answer, citations, latencyMs },
  });
}
