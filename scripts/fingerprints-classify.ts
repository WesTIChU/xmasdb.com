import 'dotenv/config';
import { MOVIES } from '../src/data/movies';
import {
  MockFingerprintClassifier,
  OpenRouterFingerprintClassifier,
  classifyFingerprintBatch,
  getFingerprintClassifierPrompt,
  validateClassifierResult,
} from '../src/server/fingerprint-classification';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const limitValue = option('--limit');
const limit = limitValue === undefined ? undefined : Number(limitValue);
if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) throw new Error('--limit must be a non-negative integer.');
const movieId = option('--movie-id');
const dryRun = process.argv.includes('--dry-run');
const provider = option('--provider') || 'openrouter';
const model = option('--model');
const useMock = process.argv.includes('--mock') || provider === 'mock';
if (provider !== 'openrouter' && !useMock) throw new Error(`Unsupported classifier provider: ${provider}`);
if (limit === undefined && !useMock) throw new Error('A real classifier run requires --limit. Full-catalogue classification is intentionally blocked in Phase 2B.');

const classifier = useMock ? new MockFingerprintClassifier() : new OpenRouterFingerprintClassifier({ model });
const selectedInputs: string[] = [];
const classifierResults: Array<{ movieId: string; title: string; input: unknown; raw: unknown; validation: ReturnType<typeof validateClassifierResult>; usage?: unknown }> = [];

const summary = await classifyFingerprintBatch(MOVIES, classifier, {
  limit,
  movieId,
  dryRun,
  onResult: ({ input, raw, validation }) => {
    selectedInputs.push(JSON.stringify(input));
    classifierResults.push({ movieId: input.movieId, title: input.title, input, raw, validation, usage: classifier instanceof OpenRouterFingerprintClassifier ? classifier.lastUsage : undefined });
  },
});
const observedUsage = classifier instanceof OpenRouterFingerprintClassifier
  ? classifierResults.map((result) => result.usage).filter((usage): usage is Record<string, unknown> => Boolean(usage && typeof usage === 'object'))
  : [];
for (const result of classifierResults) {
  console.log(`\nMOVIE: ${result.title} (${result.movieId})`);
  console.log(`JEV INPUT: ${JSON.stringify(result.input)}`);
  if (classifier instanceof OpenRouterFingerprintClassifier) console.log(`OPENROUTER MODEL: ${classifier.configuredModel}`);
  console.log(`RAW STRUCTURED RESULT: ${JSON.stringify(result.raw)}`);
  console.log(`VALIDATED FINGERPRINTS: ${JSON.stringify(result.validation.ok ? result.validation.result.fingerprints : [])}`);
  console.log(`VALIDATION RESULT: ${JSON.stringify(result.validation)}`);
  if (result.usage !== undefined) console.log(`OPENROUTER USAGE: ${JSON.stringify(result.usage)}`);
}
if (classifier instanceof OpenRouterFingerprintClassifier) {
  const usages = classifierResults.map((result) => result.usage).filter((usage): usage is Record<string, unknown> => Boolean(usage && typeof usage === 'object'));
  const totals = usages.reduce<{ input_tokens: number; output_tokens: number; cost: number }>((sum, usage) => ({
    input_tokens: sum.input_tokens + (typeof usage.input_tokens === 'number' ? usage.input_tokens : 0),
    output_tokens: sum.output_tokens + (typeof usage.output_tokens === 'number' ? usage.output_tokens : 0),
    cost: sum.cost + (typeof usage.cost === 'number' ? usage.cost : 0),
  }), { input_tokens: 0, output_tokens: 0, cost: 0 });
  console.log(`OPENROUTER TOTAL USAGE: ${JSON.stringify(totals)}`);
}
console.log(`CATALOGUE MOVIES: ${summary.catalogueMovies}`);
console.log(`ALREADY ASSIGNED: ${summary.alreadyAssigned}`);
console.log(`CHECKPOINT CLASSIFIED: ${summary.checkpointClassified}`);
console.log(`CHECKPOINT NO MATCH: ${summary.checkpointNoMatch}`);
console.log(`CHECKPOINT INSUFFICIENT DATA: ${summary.checkpointInsufficientData}`);
console.log(`CHECKPOINT FAILED: ${summary.checkpointFailed}`);
console.log(`PROCESSED: ${summary.processed}`);
console.log(`CLASSIFIED: ${summary.classified}`);
console.log(`NO FINGERPRINTS: ${summary.noMatch}`);
console.log(`INSUFFICIENT DATA: ${summary.insufficientData}`);
console.log(`FAILED: ${summary.failed}`);
console.log(`REMAINING: ${summary.remaining}`);
const observedInputTokens = observedUsage.reduce((sum, usage) => sum + (typeof usage.input_tokens === 'number' ? usage.input_tokens : 0), 0);
const estimatedInputTokensPerMovie = observedUsage.length > 0 ? Math.ceil(observedInputTokens / observedUsage.length) : Math.ceil((getFingerprintClassifierPrompt().length + (selectedInputs.length ? selectedInputs.reduce((sum, input) => sum + input.length, 0) / selectedInputs.length : 500)) / 4);
const remainingInputTokens = summary.remaining * estimatedInputTokensPerMovie;
const inputRate = Number(process.env.OPENROUTER_INPUT_COST_PER_MILLION || (classifier instanceof OpenRouterFingerprintClassifier ? '0.042' : '0.15'));
const outputRate = Number(process.env.OPENROUTER_OUTPUT_COST_PER_MILLION || (classifier instanceof OpenRouterFingerprintClassifier ? '0' : '0.60'));
const estimatedCost = (remainingInputTokens * inputRate + summary.remaining * 80 * outputRate) / 1_000_000;
console.log(`ESTIMATED REMAINING COST: ~$${estimatedCost.toFixed(2)} (using configured/default rates; approximate ${remainingInputTokens.toLocaleString()} input tokens plus ${summary.remaining * 80} output tokens)`);
console.log(dryRun ? 'DRY RUN: checkpoint and source files were not changed.' : 'Checkpoint updated; production assignments were not changed.');
