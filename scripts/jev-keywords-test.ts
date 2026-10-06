import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getBrandById } from '../src/data/brands';
import { MOVIES } from '../src/data/movies';
import { buildJevKeywordClassifierInput, OpenRouterJevKeywordClassifier, validateJevKeywordResult, type JevKeywordProposal } from '../src/server/jev-keywords';

const OUTPUT_PATH = path.resolve(process.cwd(), 'jev-keyword-test.md');
const TEST_MOVIE_IDS = [
  'hallmark-2020-christmas-by-starlight', 'lifetime-2020-christmas-on-ice', 'hallmark-2020-a-nashville-christmas-carol',
  'hallmark-2023-a-heidelberg-holiday', 'hallmark-2023-a-biltmore-christmas', 'hallmark-2020-the-christmas-house',
  'gaf-2026-christmas-wrapped-in-love', 'gaf-2021-hot-chocolate-holiday', 'uptv-2022-christmas-lucky-charm', 'hallmark-2024-believe-in-christmas',
] as const;

interface PreviewResult { movie: typeof MOVIES[number]; input: ReturnType<typeof buildJevKeywordClassifierInput>; proposals: JevKeywordProposal[]; validationRejections: string[]; validationError?: string; error?: string }

function quoteSynopsis(synopsis: string): string { return synopsis.split('\n').map((line) => `> ${line}`).join('\n'); }
function renderProposal(proposal: JevKeywordProposal): string {
  return [`#### ${proposal.keyword}`, '', 'Source: jev-synopsis', '', 'Evidence:', `> "${proposal.evidence}"`, '', 'Reason:', proposal.reason].join('\n');
}
function renderMarkdown(results: PreviewResult[], model: string): string {
  const additions = results.reduce((sum, result) => sum + result.proposals.length, 0);
  const withAdditions = results.filter((result) => result.proposals.length > 0).length;
  const existingCount = results.reduce((sum, result) => sum + result.input.existingKeywords.length, 0);
  const sections = results.map(({ movie, input, proposals, validationRejections, validationError, error }) => [
    '---', '', `## ${movie.title}`, '', `TMDB ID: ${movie.tmdbId}`, `IMDb ID: ${movie.imdbId || 'Not stored'}`, `Network: ${getBrandById(movie.brandId)?.shortName || movie.brandId}`, '', 'Synopsis:', '', quoteSynopsis(movie.synopsis), '', '### Existing Keywords', '', input.existingKeywords.length > 0 ? input.existingKeywords.map((keyword) => `- ${keyword}`).join('\n') : 'None', '', '### Jev Proposed Additions', '', proposals.length > 0 ? proposals.map(renderProposal).join('\n\n') : 'None.', ...(validationError || error ? ['', '### Diagnostics', '', `- ${validationError || error}`] : []), ...(validationRejections.length > 0 ? ['', '### Validation Rejections', '', validationRejections.map((rejection) => `- ${rejection}`).join('\n')] : []),
  ].join('\n')).join('\n\n');
  return ['# Jev Keywords Test', '', '## Summary', '', 'Movies tested: 10', `Movies with additions: ${withAdditions}`, `Movies with zero additions: ${results.length - withAdditions}`, `Existing keywords supplied to Jev: ${existingCount}`, `New keywords proposed: ${additions}`, '', `Model: ${model}`, `Decision threshold: ${process.env.OPENROUTER_JEV_KEYWORD_THRESHOLD || '0.6'}`, '', sections, ''].join('\n');
}

const movies = TEST_MOVIE_IDS.map((id) => MOVIES.find((movie) => movie.id === id));
if (movies.some((movie) => !movie) || movies.length !== 10) throw new Error('The Jev Keywords test sample must contain exactly 10 catalogue movies.');
const classifier = new OpenRouterJevKeywordClassifier();
const results: PreviewResult[] = [];
for (const movie of movies as Array<typeof MOVIES[number]>) {
  const input = buildJevKeywordClassifierInput(movie);
  try {
    const raw = await classifier.classifyMovie(input);
    const validation = validateJevKeywordResult(raw, input);
    if (!validation.ok) { console.error(`JEV REJECTED ${movie.title}: ${validation.error}`); results.push({ movie, input, proposals: [], validationRejections: [], validationError: validation.error }); }
    else { console.log(`JEV ${movie.title}: ${validation.result.newKeywords.length} additions; ${validation.rejected.length} rejected`); results.push({ movie, input, proposals: validation.result.newKeywords, validationRejections: validation.rejected }); }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`JEV FAILED ${movie.title}: ${message}`);
    results.push({ movie, input, proposals: [], validationRejections: [], error: message });
  }
}
await fs.writeFile(OUTPUT_PATH, renderMarkdown(results, classifier.configuredModel), 'utf8');
console.log(`Wrote ${OUTPUT_PATH}`);
