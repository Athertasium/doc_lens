import Groq from "groq-sdk";
import { RetrievedChunk, Citation } from "@/lib/types";

const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are a precise document assistant. Your rules:
1. Answer ONLY using the provided context chunks below.
2. For every factual claim, add a citation marker like [1] or [2] immediately after it.
3. If the context does not contain enough information to answer, respond with exactly: "The provided documents don't contain enough information to answer this question."
4. Do not infer, extrapolate, or use outside knowledge.
5. Citations must match the chunk numbers exactly as labeled in the context.`;

function buildUserPrompt(chunks: RetrievedChunk[], question: string): string {
  const contextBlock = chunks
    .map(
      (c, i) =>
        `[${i + 1}] (${c.filename}, page ${c.pageNumber}, score: ${c.score.toFixed(3)})\n${c.content}`
    )
    .join("\n\n");

  return `Context:\n${contextBlock}\n\nQuestion: ${question}`;
}

function parseCitations(text: string): number[] {
  const cited = new Set<number>();
  for (const match of text.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g)) {
    match[1].split(",").forEach((n) => cited.add(parseInt(n.trim())));
  }
  return Array.from(cited);
}

export async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[]
): Promise<{ answer: string; citations: Citation[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const client = new Groq({ apiKey });

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(chunks, question) },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  });

  const answer = completion.choices[0]?.message?.content ?? "";

  const citedIndices = parseCitations(answer);

  const citations: Citation[] = citedIndices
    .filter((i) => i >= 1 && i <= chunks.length)
    .map((i) => {
      const chunk = chunks[i - 1];
      return {
        chunkId: chunk.id,
        score: chunk.score,
        pageNumber: chunk.pageNumber,
        snippet: chunk.content.slice(0, 300),
        filename: chunk.filename,
      };
    });

  return { answer, citations };
}
