import type { ChunkMetadata, TextChunk } from "@/lib/types";
export type { ChunkMetadata, TextChunk };

const CHARS_PER_TOKEN = 4;
const CHUNK_SIZE_TOKENS = 400;
const OVERLAP_TOKENS = 60;
const CHUNK_SIZE_CHARS = 550;
const OVERLAP_CHARS = 60;

const SPLIT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

function splitText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  for (const sep of SPLIT_SEPARATORS) {
    if (sep === "") {
      const parts: string[] = [];
      for (let i = 0; i < text.length; i += maxChars) {
        parts.push(text.slice(i, i + maxChars));
      }
      return parts;
    }

    const idx = text.lastIndexOf(sep, maxChars);
    if (idx > 0) {
      const head = text.slice(0, idx + sep.length);
      const tail = text.slice(idx + sep.length);
      return [head, ...splitText(tail, maxChars)];
    }
  }

  return [text];
}

export function chunkPageText(
  pageText: string,
  pageNumber: number,
  sourceFile: string,
  startChunkIndex = 0
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const rawSplits = splitText(pageText.trim(), CHUNK_SIZE_CHARS);

  let charOffset = 0;
  let chunkIndex = startChunkIndex;

  for (let i = 0; i < rawSplits.length; i++) {
    const content = rawSplits[i].trim();
    if (!content) continue;

    const prevTail = i > 0 ? rawSplits[i - 1].slice(-OVERLAP_CHARS).trim() : "";
    const finalContent = prevTail ? `${prevTail} ${content}` : content;

    chunks.push({
      content: finalContent,
      metadata: {
        sourceFile,
        pageNumber,
        chunkIndex,
        charOffset,
        tokenCount: Math.ceil(finalContent.length / CHARS_PER_TOKEN),
      },
    });

    charOffset += rawSplits[i].length;
    chunkIndex++;
  }

  return chunks;
}

export function chunkDocument(
  pages: Array<{ text: string; pageNumber: number }>,
  sourceFile: string
): TextChunk[] {
  const all: TextChunk[] = [];
  for (const page of pages) {
    if (!page.text.trim()) continue;
    const pageChunks = chunkPageText(page.text, page.pageNumber, sourceFile, all.length);
    all.push(...pageChunks);
  }
  return all;
}
