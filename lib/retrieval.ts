import { db } from "@/lib/db";
import { RetrievedChunk } from "@/lib/types";

interface RawChunkRow {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  charOffset: number;
  filename: string;
  score: number | string;
}

export async function denseRetrieve(
  queryEmbedding: number[],
  sessionId: string,
  topK = 10
): Promise<RetrievedChunk[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await db.$queryRaw<RawChunkRow[]>`
    SELECT
      c.id,
      c.content,
      c."pageNumber",
      c."chunkIndex",
      c."charOffset",
      d.filename,
      1 - (c.embedding <=> ${vectorLiteral}::vector) AS score
    FROM "Chunk" c
    JOIN "Document" d ON c."documentId" = d.id
    WHERE d."sessionId" = ${sessionId}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `;

  return rows.map((r) => ({
    ...r,
    pageNumber: Number(r.pageNumber),
    chunkIndex: Number(r.chunkIndex),
    charOffset: Number(r.charOffset),
    score: Number(r.score),
  }));
}
