const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/embeddings";
const NVIDIA_MODEL = "nvidia/llama-nemotron-embed-vl-1b-v2";
const OPENAI_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 32;

async function embedBatchNvidia(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const res = await fetch(NVIDIA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: NVIDIA_MODEL,
      input_type: "passage",
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    throw new Error(`NVIDIA API error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  return (json.data as Array<{ index: number; embedding: number[] }>)
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

async function embedBatchOpenAI(texts: string[]): Promise<number[][]> {
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const res = await client.embeddings.create({
    model: OPENAI_MODEL,
    input: texts,
  });

  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  if (process.env.NVIDIA_API_KEY) {
    return embedBatchNvidia(texts);
  }
  return embedBatchOpenAI(texts);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await embedBatch(batch);
    results.push(...batchEmbeddings);
  }

  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  if (process.env.NVIDIA_API_KEY) {
    const res = await fetch(NVIDIA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        input: [text],
        model: NVIDIA_MODEL,
        input_type: "query",
        encoding_format: "float",
      }),
    });

    if (!res.ok) {
      throw new Error(`NVIDIA API error ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    return json.data[0].embedding as number[];
  }

  const [embedding] = await embedBatchOpenAI([text]);
  return embedding;
}
