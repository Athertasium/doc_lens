export interface GoldenEntry {
  id: string;
  question: string;
  is_in_scope: boolean;
  expected_answer_contains?: string[];
  expected_source_chunk_contains?: string;
  expected_abstain?: boolean;
}

export interface EvalResult {
  id: string;
  question: string;
  is_in_scope: boolean;
  answer: string;
  citedIndices: number[];
  totalChunks: number;
  retrievedChunkContents: string[];
  retrievalRecall: boolean | null;
  answerFaithfulness: boolean | null;
  citationAccuracy: boolean;
  abstentionCorrect: boolean | null;
  latencyMs: number;
}

export interface EvalSummary {
  total: number;
  inScopeCount: number;
  outOfScopeCount: number;
  retrievalRecallAt5: number;
  answerFaithfulness: number;
  citationAccuracy: number;
  abstentionRate: number;
  avgLatencyMs: number;
}
