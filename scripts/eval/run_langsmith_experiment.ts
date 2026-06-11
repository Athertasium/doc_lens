import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";
import type { Run, Example } from "langsmith/schemas";
import { embedQuery } from "@/lib/embeddings";
import { hybridRetrieve } from "@/lib/retrieval";
import { generateAnswer } from "@/lib/generator";
import type { GoldenEntry } from "./types";
import type { RetrievedChunk } from "@/lib/types";

const DATASET_NAME = "doclens-golden-dataset";
const ABSTAIN_PHRASE = "the provided documents don't contain enough information";

interface TargetOutput {
  answer: string;
  citedIndices: number[];
  retrievedChunkContents: string[];
  totalChunks: number;
  latencyMs: number;
}

async function upsertDataset(
  client: Client,
  entries: GoldenEntry[]
): Promise<string> {
  try {
    const existing = await client.readDataset({ datasetName: DATASET_NAME });
    console.log(`Dataset exists: "${DATASET_NAME}" (${existing.id})`);
    return existing.id;
  } catch {
    console.log(`Creating dataset: "${DATASET_NAME}"`);
    const dataset = await client.createDataset(DATASET_NAME, {
      description:
        "DocLens golden dataset — 15 in-scope, 5 out-of-scope questions against drylab.pdf",
    });

    await client.createExamples({
      datasetId: dataset.id,
      inputs: entries.map((e) => ({
        question: e.question,
        is_in_scope: e.is_in_scope,
      })),
      outputs: entries.map((e) => ({
        expected_answer_contains: e.expected_answer_contains ?? [],
        expected_source_chunk_contains: e.expected_source_chunk_contains ?? null,
        expected_abstain: e.expected_abstain ?? false,
        is_in_scope: e.is_in_scope,
      })),
    });

    console.log(`Uploaded ${entries.length} examples`);
    return dataset.id;
  }
}

function makeTargetFn(sessionId: string) {
  return async (input: Record<string, unknown>): Promise<TargetOutput> => {
    const question = input.question as string;
    const start = Date.now();

    const queryEmbedding = await embedQuery(question);
    const chunks: RetrievedChunk[] = await hybridRetrieve(
      question,
      queryEmbedding,
      sessionId
    );

    const { answer, citations } =
      chunks.length > 0
        ? await generateAnswer(question, chunks)
        : {
            answer:
              "The provided documents don't contain enough information to answer this question.",
            citations: [],
          };

    const citedIndices = citations.map(
      (c) => chunks.findIndex((ch) => ch.id === c.chunkId) + 1
    );

    return {
      answer,
      citedIndices,
      retrievedChunkContents: chunks.map((c) => c.content.toLowerCase()),
      totalChunks: chunks.length,
      latencyMs: Date.now() - start,
    };
  };
}

// ── Evaluators ──────────────────────────────────────────────────────────────

function evalRetrievalRecall(args: { run: Run; example: Example }) {
  const ref = args.example.outputs as Record<string, unknown>;
  if (!ref.is_in_scope || !ref.expected_source_chunk_contains) {
    return { key: "retrieval_recall_at5", score: null };
  }

  const out = args.run.outputs as TargetOutput;
  const needle = (ref.expected_source_chunk_contains as string).toLowerCase();
  const found = out.retrievedChunkContents.some((c) => c.includes(needle));

  return { key: "retrieval_recall_at5", score: found ? 1 : 0 };
}

function evalAnswerFaithfulness(args: { run: Run; example: Example }) {
  const ref = args.example.outputs as Record<string, unknown>;
  if (!ref.is_in_scope) return { key: "answer_faithfulness", score: null };

  const phrases = (ref.expected_answer_contains ?? []) as string[];
  if (phrases.length === 0) return { key: "answer_faithfulness", score: null };

  const out = args.run.outputs as TargetOutput;
  const answerLower = out.answer.toLowerCase();
  const allFound = phrases.every((p) => answerLower.includes(p.toLowerCase()));

  return { key: "answer_faithfulness", score: allFound ? 1 : 0 };
}

function evalCitationAccuracy(args: { run: Run; example: Example }) {
  const out = args.run.outputs as TargetOutput;
  const valid =
    out.citedIndices.length === 0 ||
    out.citedIndices.every((i) => i >= 1 && i <= out.totalChunks);

  return { key: "citation_accuracy", score: valid ? 1 : 0 };
}

function evalAbstentionRate(args: { run: Run; example: Example }) {
  const ref = args.example.outputs as Record<string, unknown>;
  if (ref.is_in_scope) return { key: "abstention_correct", score: null };

  const out = args.run.outputs as TargetOutput;
  const abstained = out.answer.toLowerCase().includes(ABSTAIN_PHRASE);

  return { key: "abstention_correct", score: abstained ? 1 : 0 };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    console.error("SESSION_ID env var required");
    console.error(
      "Usage: SESSION_ID=<id> bun scripts/eval/run_langsmith_experiment.ts"
    );
    process.exit(1);
  }

  if (!process.env.LANGCHAIN_API_KEY) {
    console.error("LANGCHAIN_API_KEY env var required");
    process.exit(1);
  }

  const { default: dataset } = (await import("./golden_dataset.json")) as {
    default: GoldenEntry[];
  };

  const client = new Client();
  await upsertDataset(client, dataset);

  console.log(`\nRunning experiment against session: ${sessionId}`);

  const results = await evaluate(makeTargetFn(sessionId), {
    data: DATASET_NAME,
    evaluators: [
      evalRetrievalRecall,
      evalAnswerFaithfulness,
      evalCitationAccuracy,
      evalAbstentionRate,
    ],
    experimentPrefix: "doclens-hybrid-rrf",
    metadata: {
      model: "llama-3.3-70b-versatile",
      retrieval: "hybrid_rrf_k60",
      embedding: "llama-nemotron-embed-vl-1b-v2",
      sessionId,
    },
    maxConcurrency: 1,
  });

  console.log("\n─── Experiment complete ───");
  console.log(`Results URL: ${results.experimentName}`);

  const rows = await Array.fromAsync(results.results);

  const avg = (key: string) => {
    const vals = rows.flatMap((r) => {
      const feedback = r.evaluationResults?.results ?? [];
      return feedback
        .filter((f) => f.key === key && f.score != null)
        .map((f) => Number(f.score));
    });
    return vals.length
      ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)
      : "n/a";
  };

  console.log(`\nMetric summary (${rows.length} examples):`);
  console.log(`  retrieval_recall_at5  ${avg("retrieval_recall_at5")}`);
  console.log(`  answer_faithfulness   ${avg("answer_faithfulness")}`);
  console.log(`  citation_accuracy     ${avg("citation_accuracy")}`);
  console.log(`  abstention_correct    ${avg("abstention_correct")}`);
  console.log("\nView full results in LangSmith dashboard.");
}

main().catch((err) => {
  console.error("Experiment failed:", err);
  process.exit(1);
});
