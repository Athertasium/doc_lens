import { traceable } from "langsmith/traceable";
import { hybridRetrieve as _hybridRetrieve } from "@/lib/retrieval";
import { generateAnswer as _generateAnswer } from "@/lib/generator";
import { RetrievedChunk, Citation } from "@/lib/types";

export const tracedHybridRetrieve = traceable(
  async (
    question: string,
    queryEmbedding: number[],
    sessionId: string
  ): Promise<RetrievedChunk[]> => {
    return _hybridRetrieve(question, queryEmbedding, sessionId);
  },
  {
    name: "retrieve",
    run_type: "retriever",
    metadata: { method: "hybrid_rrf" },
  }
);

export const tracedGenerateAnswer = traceable(
  async (
    question: string,
    chunks: RetrievedChunk[]
  ): Promise<{ answer: string; citations: Citation[] }> => {
    return _generateAnswer(question, chunks);
  },
  {
    name: "generate",
    run_type: "llm",
    metadata: { model: "llama-3.3-70b-versatile" },
  }
);
