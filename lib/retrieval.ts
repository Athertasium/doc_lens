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

export async function bm25Retrieve(
  query: string,
  sessionId: string,
  topK = 20
): Promise<RetrievedChunk[]> {
  const rows = await db.$queryRaw<RawChunkRow[]>`
    SELECT
      c.id,
      c.content,
      c."pageNumber",
      c."chunkIndex",
      c."charOffset",
      d.filename,
      ts_rank(c.tsv, plainto_tsquery('english', ${query})) AS score
    FROM "Chunk" c
    JOIN "Document" d ON c."documentId" = d.id
    WHERE d."sessionId" = ${sessionId}
      AND c.tsv IS NOT NULL
      AND c.tsv @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC
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

export function reciprocalRankFusion(
  denseResults: RetrievedChunk[],
  bm25Results: RetrievedChunk[],
  k = 60
): RetrievedChunk[] {
  const scores = new Map<string, number>();
  const chunkMap = new Map<string, RetrievedChunk>();

  for (const [rank, chunk] of denseResults.entries()) {
    scores.set(chunk.id, (scores.get(chunk.id) ?? 0) + 1 / (k + rank + 1));
    chunkMap.set(chunk.id, chunk);
  }

  for (const [rank, chunk] of bm25Results.entries()) {
    scores.set(chunk.id, (scores.get(chunk.id) ?? 0) + 1 / (k + rank + 1));
    if (!chunkMap.has(chunk.id)) chunkMap.set(chunk.id, chunk);
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, rrfScore]) => ({ ...chunkMap.get(id)!, rrfScore }));
}

export async function hybridRetrieve(
  query: string,
  queryEmbedding: number[],
  sessionId: string
): Promise<RetrievedChunk[]> {
  const [denseResults, bm25Results] = await Promise.all([
    denseRetrieve(queryEmbedding, sessionId, 20),
    bm25Retrieve(query, sessionId, 20).catch((err) => {
      console.error("bm25Retrieve failed, falling back to dense-only:", err);
      return [] as RetrievedChunk[];
    }),
  ]);

  return reciprocalRankFusion(denseResults, bm25Results);
}
