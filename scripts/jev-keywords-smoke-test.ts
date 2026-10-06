import 'dotenv/config';
import fs from 'node:fs/promises';
import { MOVIES } from '../src/data/movies';
import { OpenRouterJevKeywordClassifier, buildJevKeywordClassifierInput, validateJevKeywordResult, type JevKeywordClassifier } from '../src/server/jev-keywords';
import { JEV_KEYWORD_CHECKPOINT_PATH, fingerprintJevKeywordInput } from '../src/server/jev-keyword-refresh';
import { refreshTmdbMovie } from '../src/utils/tmdb-refresh';
import type { Movie } from '../src/types';

const TMDB_ID = 746045;
const movie = MOVIES.find((entry) => entry.tmdbId === TMDB_ID);
if (!movie) throw new Error(`Movie ${TMDB_ID} is not present in the catalogue.`);
if (!process.env.TMDB_API_KEY) throw new Error('Missing TMDB_API_KEY.');

const realClassifier = new OpenRouterJevKeywordClassifier();
let apiCalls = 0;
let capturedInput: ReturnType<typeof buildJevKeywordClassifierInput> | undefined;
let capturedResponse: unknown;
const classifier: JevKeywordClassifier = {
  async classifyMovie(input) {
    apiCalls += 1;
    capturedInput = input;
    capturedResponse = await realClassifier.classifyMovie(input);
    return capturedResponse;
  },
};

const imageCache = (async () => undefined) as Parameters<typeof refreshTmdbMovie>[2];
let jevFailure: string | undefined;
const result = await refreshTmdbMovie(movie, process.env.TMDB_API_KEY, imageCache, undefined, undefined, {
  classifier,
  onFailure: (failure) => { jevFailure = failure.message; },
});

if (jevFailure) throw new Error(`Jev failed: ${jevFailure}`);
if (apiCalls !== 1) throw new Error(`Expected exactly one Jev API call, received ${apiCalls}.`);
if (!capturedInput || capturedResponse === undefined) throw new Error('The Jev response was not captured.');

const validation = validateJevKeywordResult(capturedResponse, capturedInput);
if (!validation.ok) throw new Error(`Jev response failed validation: ${validation.error}`);
const jevKeywords = (result.keywords || []).filter((keyword): keyword is Extract<NonNullable<Movie['keywords']>[number], { evidence: string }> => !('id' in keyword));
if (!jevKeywords.some((keyword) => keyword.name === 'family business' && keyword.evidence === 'family’s restaurant')) {
  throw new Error('Expected family business Jev keyword was not produced.');
}
if (jevKeywords.some((keyword) => 'id' in keyword)) throw new Error('A Jev keyword received an ID.');

const checkpoint = JSON.parse(await fs.readFile(JEV_KEYWORD_CHECKPOINT_PATH, 'utf8')) as {
  entries?: Record<string, { status?: string; fingerprint?: string }>;
};
const entry = checkpoint.entries?.[movie.id];
if (!entry || entry.status !== 'success' || entry.fingerprint !== fingerprintJevKeywordInput(result)) {
  throw new Error('The Jev checkpoint was not recorded for the resulting movie state.');
}

const printableKeywords = (result.keywords || []).map((keyword) => 'id' in keyword
  ? { type: 'tmdb', id: keyword.id, name: keyword.name }
  : { type: 'jev', name: keyword.name, evidence: keyword.evidence });
console.log(JSON.stringify({
  tmdbId: TMDB_ID,
  model: realClassifier.configuredModel,
  jevApiCalls: apiCalls,
  jevResponse: capturedResponse,
  validatedKeywords: validation.result.newKeywords,
  validationRejections: validation.rejected,
  finalKeywords: printableKeywords,
  checkpoint: { status: entry.status, fingerprintMatchesResult: entry.fingerprint === fingerprintJevKeywordInput(result) },
}, null, 2));
