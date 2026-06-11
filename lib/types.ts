export interface ChunkMetadata {
  sourceFile: string;
  pageNumber: number;
  chunkIndex: number;
  charOffset: number;
  tokenCount: number;
}

export interface TextChunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UploadResult {
  sessionId: string;
  documentId: string;
  pageCount: number | null;
  chunkCount: number | undefined;
}

export interface IngestResult {
  chunkCount: number;
  embeddingDurationMs: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  charOffset: number;
  filename: string;
  score: number;
}

export interface Citation {
  chunkId: string;
  score: number;
  pageNumber: number;
  snippet: string;
  filename: string;
}

export interface QueryResult {
  answer: string;
  citations: Citation[];
  latencyMs: number;
}
