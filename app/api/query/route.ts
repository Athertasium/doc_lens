import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { embedQuery } from "@/lib/embeddings";
import { tracedHybridRetrieve, tracedGenerateAnswer } from "@/lib/langsmith";
import { db } from "@/lib/db";
import { ApiResponse, QueryResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;

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
  const chunks = await tracedHybridRetrieve(question, queryEmbedding, sessionId);

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

  const { answer, citations } = await tracedGenerateAnswer(question, chunks);
  const latencyMs = Date.now() - start;

  await Promise.all([
    db.queryLog.create({
      data: {
        sessionId,
        userId,
        question,
        answer,
        citedChunks: citations as object[],
        latencyMs,
      },
    }),
    userId
      ? db.chatSession.updateMany({
          where: { id: sessionId, userId },
          data: { updatedAt: new Date() },
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json<ApiResponse<QueryResult>>({
    success: true,
    data: { answer, citations, latencyMs },
  });
}
