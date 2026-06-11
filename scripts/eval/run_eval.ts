import { embedQuery } from "@/lib/embeddings";
import { hybridRetrieve } from "@/lib/retrieval";
import { generateAnswer } from "@/lib/generator";
import type { GoldenEntry, EvalResult, EvalSummary } from "./types";

const ABSTAIN_PHRASE = "the provided documents don't contain enough information";

async function runEntry(
  entry: GoldenEntry,
  sessionId: string
): Promise<EvalResult> {
  const start = Date.now();

  const queryEmbedding = await embedQuery(entry.question);
  const chunks = await hybridRetrieve(entry.question, queryEmbedding, sessionId);

  const { answer, citations } =
    chunks.length > 0
      ? await generateAnswer(entry.question, chunks)
      : {
          answer:
            "The provided documents don't contain enough information to answer this question.",
          citations: [],
        };

  const latencyMs = Date.now() - start;
  const answerLower = answer.toLowerCase();
  const citedIndices = citations.map((c) =>
    chunks.findIndex((ch) => ch.id === c.chunkId) + 1
  );

  const retrievedChunkContents = chunks.map((c) => c.content.toLowerCase());

  const retrievalRecall: boolean | null = entry.is_in_scope
    ? entry.expected_source_chunk_contains !== undefined
      ? retrievedChunkContents.some((content) =>
          content.includes(entry.expected_source_chunk_contains!.toLowerCase())
        )
      : null
    : null;

  const answerFaithfulness: boolean | null = entry.is_in_scope
    ? entry.expected_answer_contains !== undefined
      ? entry.expected_answer_contains.every((phrase) =>
          answerLower.includes(phrase.toLowerCase())
        )
      : null
    : null;

  const citationAccuracy =
    citedIndices.length > 0
      ? citedIndices.every((i) => i >= 1 && i <= chunks.length)
      : true;

  const abstentionCorrect: boolean | null = !entry.is_in_scope
    ? answerLower.includes(ABSTAIN_PHRASE)
    : null;

  return {
    id: entry.id,
    question: entry.question,
    is_in_scope: entry.is_in_scope,
    answer,
    citedIndices,
    totalChunks: chunks.length,
    retrievedChunkContents,
    retrievalRecall,
    answerFaithfulness,
    citationAccuracy,
    abstentionCorrect,
    latencyMs,
  };
}

function computeSummary(results: EvalResult[]): EvalSummary {
  const inScopeResults = results.filter((r) => r.is_in_scope);
  const outOfScopeResults = results.filter((r) => !r.is_in_scope);

  const recallResults = inScopeResults.filter(
    (r) => r.retrievalRecall !== null
  );
  const faithfulnessResults = inScopeResults.filter(
    (r) => r.answerFaithfulness !== null
  );
  const abstentionResults = outOfScopeResults.filter(
    (r) => r.abstentionCorrect !== null
  );

  const retrievalRecallAt5 =
    recallResults.length > 0
      ? recallResults.filter((r) => r.retrievalRecall).length /
        recallResults.length
      : 0;

  const answerFaithfulness =
    faithfulnessResults.length > 0
      ? faithfulnessResults.filter((r) => r.answerFaithfulness).length /
        faithfulnessResults.length
      : 0;

  const citationAccuracy =
    results.length > 0
      ? results.filter((r) => r.citationAccuracy).length / results.length
      : 0;

  const abstentionRate =
    abstentionResults.length > 0
      ? abstentionResults.filter((r) => r.abstentionCorrect).length /
        abstentionResults.length
      : 0;

  const avgLatencyMs =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
      : 0;

  return {
    total: results.length,
    inScopeCount: inScopeResults.length,
    outOfScopeCount: outOfScopeResults.length,
    retrievalRecallAt5,
    answerFaithfulness,
    citationAccuracy,
    abstentionRate,
    avgLatencyMs,
  };
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function bar(n: number, width = 20): string {
  const filled = Math.round(n * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function printResults(results: EvalResult[], summary: EvalSummary): void {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DocLens Eval Suite — Results");
  console.log("═══════════════════════════════════════════════════════════\n");

  for (const r of results) {
    const status = r.is_in_scope
      ? r.retrievalRecall === true
        ? "✓"
        : r.retrievalRecall === false
        ? "✗"
        : "~"
      : r.abstentionCorrect === true
      ? "✓"
      : "✗";

    const tag = r.is_in_scope ? "[IN]" : "[OUT]";
    console.log(`${status} ${r.id} ${tag} ${r.question.slice(0, 60)}`);
    if (!r.is_in_scope) {
      console.log(
        `   abstain: ${r.abstentionCorrect ? "PASS" : "FAIL"} | ${r.answer.slice(0, 80)}...`
      );
    } else {
      console.log(
        `   recall: ${r.retrievalRecall ?? "n/a"} | faithful: ${r.answerFaithfulness ?? "n/a"} | cite_ok: ${r.citationAccuracy} | ${r.latencyMs}ms`
      );
    }
  }

  const recallN = results
    .filter((r) => r.is_in_scope && r.retrievalRecall !== null)
    .filter((r) => r.retrievalRecall).length;
  const recallD = results.filter(
    (r) => r.is_in_scope && r.retrievalRecall !== null
  ).length;
  const faithN = results
    .filter((r) => r.is_in_scope && r.answerFaithfulness !== null)
    .filter((r) => r.answerFaithfulness).length;
  const faithD = results.filter(
    (r) => r.is_in_scope && r.answerFaithfulness !== null
  ).length;
  const citeN = results.filter((r) => r.citationAccuracy).length;
  const abstainN = results
    .filter((r) => !r.is_in_scope && r.abstentionCorrect !== null)
    .filter((r) => r.abstentionCorrect).length;
  const abstainD = results.filter(
    (r) => !r.is_in_scope && r.abstentionCorrect !== null
  ).length;

  console.log("\n───────────────────────────────────────────────────────────");
  console.log("  Metrics");
  console.log("───────────────────────────────────────────────────────────");
  console.log(
    `  Retrieval Recall@5  ${bar(summary.retrievalRecallAt5)} ${pct(summary.retrievalRecallAt5).padStart(6)}  (${recallN}/${recallD})`
  );
  console.log(
    `  Answer Faithfulness ${bar(summary.answerFaithfulness)} ${pct(summary.answerFaithfulness).padStart(6)}  (${faithN}/${faithD})`
  );
  console.log(
    `  Citation Accuracy   ${bar(summary.citationAccuracy)} ${pct(summary.citationAccuracy).padStart(6)}  (${citeN}/${results.length})`
  );
  console.log(
    `  Abstention Rate     ${bar(summary.abstentionRate)} ${pct(summary.abstentionRate).padStart(6)}  (${abstainN}/${abstainD})`
  );
  console.log(
    `  Avg Latency         ${Math.round(summary.avgLatencyMs)}ms`
  );
  console.log("\n───────────────────────────────────────────────────────────");
  console.log(
    `  Total: ${summary.total} queries | In-scope: ${summary.inScopeCount} | Out-of-scope: ${summary.outOfScopeCount}`
  );
  console.log("═══════════════════════════════════════════════════════════\n");
}

async function main(): Promise<void> {
  const sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    console.error("Error: SESSION_ID env var required");
    console.error("Usage: SESSION_ID=<id> bun scripts/eval/run_eval.ts");
    process.exit(1);
  }

  const { default: dataset } = (await import("./golden_dataset.json")) as {
    default: GoldenEntry[];
  };
  const filter = process.env.EVAL_FILTER;
  const entries = filter
    ? dataset.filter((e) => e.id === filter || e.question.includes(filter))
    : dataset;

  console.log(
    `\nRunning eval: ${entries.length} entries against session ${sessionId}`
  );

  const results: EvalResult[] = [];
  for (const entry of entries) {
    process.stdout.write(`  ${entry.id}...`);
    const result = await runEntry(entry, sessionId);
    results.push(result);
    process.stdout.write(` ${result.latencyMs}ms\n`);
  }

  const summary = computeSummary(results);
  printResults(results, summary);

  if (process.env.EVAL_OUTPUT) {
    const { writeFile } = await import("fs/promises");
    await writeFile(
      process.env.EVAL_OUTPUT,
      JSON.stringify({ summary, results }, null, 2),
      "utf-8"
    );
    console.log(`Results written to ${process.env.EVAL_OUTPUT}`);
  }
}

main().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
