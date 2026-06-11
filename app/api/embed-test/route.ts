import { NextRequest, NextResponse } from "next/server";
import { embedQuery } from "@/lib/embeddings";

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ success: false, error: "text required" }, { status: 400 });
  }

  const start = Date.now();
  const embedding = await embedQuery(text.trim());
  const latencyMs = Date.now() - start;

  return NextResponse.json({
    success: true,
    data: {
      model: "nvidia/llama-nemotron-embed-vl-1b-v2",
      dim: embedding.length,
      preview: embedding.slice(0, 8),
      latencyMs,
    },
  });
}
