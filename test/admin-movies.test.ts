import assert from 'node:assert/strict';
import { buildMovieFromTmdb, extractTmdbId, generateMoviesModule, normalizeBrand, normalizeStatus, parseBulkMovieInput, parseMoviesModule } from '../src/server/movie-import';
import { commitMoviesToGitHub, readGitHubBranch } from '../src/server/github-catalogue';
import { fetchTmdbMovie } from '../src/utils/tmdb';
import fs from 'node:fs/promises';
import path from 'node:path';

assert.equal(extractTmdbId('1547913'), 1547913);
assert.equal(extractTmdbId('https://www.themoviedb.org/movie/1547913-some-movie'), 1547913);
assert.equal(extractTmdbId('not-a-movie'), undefined);
assert.equal(normalizeBrand('Great American Family'), 'gaf');
assert.equal(normalizeStatus('COMING-SOON'), 'coming-soon');

const parsed = parseBulkMovieInput('1547913\n\n1064137 | lifetime | collection\n1234567 | GAF | coming-soon', 'hallmark', 'coming-soon');
assert.equal(parsed.items.length, 3, 'blank lines are ignored');
assert.deepEqual(parsed.items[0], { line: 1, tmdbId: 1547913, brand: 'hallmark', status: 'coming-soon' });
assert.deepEqual(parsed.items[1], { line: 3, tmdbId: 1064137, brand: 'lifetime', status: 'collection' });
assert.deepEqual(parsed.items[2], { line: 4, tmdbId: 1234567, brand: 'gaf', status: 'coming-soon' });
assert.equal(parseBulkMovieInput('1\n1', 'hallmark', 'collection').items[1].error?.includes('duplicate'), true);
assert.equal(parseBulkMovieInput('1 | invalid | collection', 'hallmark', 'collection').items[0].error?.includes('unsupported brand'), true);
assert.equal(parseBulkMovieInput('1 | hallmark | invalid', 'hallmark', 'collection').items[0].error?.includes('status'), true);
assert.equal(parseBulkMovieInput(Array.from({ length: 51 }, (_, index) => String(index + 1)).join('\n'), 'hallmark', 'collection').error !== undefined, true);

const movie = buildMovieFromTmdb(1547913, { title: 'A Preview Christmas', releaseDate: '2026-12-01', synopsis: 'Overview', cast: [] }, 'hallmark', 'coming-soon');
assert.equal(movie.tmdbId, 1547913);
assert.equal(movie.brandId, 'hallmark');
assert.equal(movie.status, 'coming-soon');
assert.equal(movie.isComingSoon, true);
assert.match(generateMoviesModule([movie]), /A Preview Christmas/);
const canonicalSource = await fs.readFile(path.join(process.cwd(), 'src/data/movies.ts'), 'utf8');
const canonicalMovies = parseMoviesModule(canonicalSource);
assert.ok(canonicalMovies.length > 0, 'The canonical movies.ts export should load in the shared parser');
assert.equal(canonicalMovies.find((entry) => entry.tmdbId === 1575393), undefined);
assert.throws(() => parseMoviesModule('export const MOVIES: Movie[] = nope;'), /unexpected format|invalid movie data/);

const originalFetch = globalThis.fetch;
const source = canonicalSource;
const encodedSource = Buffer.from(source, 'utf8').toString('base64');
let commitCreateCalls = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  const method = init?.method || 'GET';
  if (url.endsWith('/git/ref/heads/main')) return new Response(JSON.stringify({ object: { sha: 'base-sha' } }), { status: 200 });
  if (url.includes('/git/commits/base-sha')) return new Response(JSON.stringify({ tree: { sha: 'tree-sha' } }), { status: 200 });
  if (method === 'GET' && url.includes('/git/trees/tree-sha?recursive=1')) return new Response(JSON.stringify({ tree: [{ path: 'src/data/movies.ts', type: 'blob', sha: 'movies-blob-sha' }] }), { status: 200 });
  if (method === 'GET' && url.endsWith('/git/blobs/movies-blob-sha')) return new Response(JSON.stringify({ content: encodedSource, encoding: 'base64' }), { status: 200 });
  if (method === 'POST' && url.endsWith('/git/commits')) { commitCreateCalls += 1; return new Response(JSON.stringify({ sha: 'new-commit' }), { status: 201 }); }
  if (method === 'POST' && url.endsWith('/git/blobs')) return new Response(JSON.stringify({ sha: 'blob-sha' }), { status: 201 });
  if (method === 'POST' && url.endsWith('/git/trees')) return new Response(JSON.stringify({ sha: 'new-tree' }), { status: 201 });
  if (method === 'PATCH' && url.includes('/git/refs/heads/main')) return new Response('{}', { status: 200 });
  if (url.includes('/movie/1575393?')) return new Response(JSON.stringify({ id: 1575393, title: 'A Runaway Bride for Christmas', release_date: '2025-12-01' }), { status: 200 });
  return new Response('{}', { status: 404 });
};
const branch = await readGitHubBranch({ token: 'token', owner: 'owner', repo: 'repo', branch: 'main' });
assert.equal(branch.movies.length, canonicalMovies.length, 'Production-compatible branch loading should parse canonical movies.ts');
assert.ok(branch.movies.some((entry) => entry.tmdbId === 1575393) === false, 'Preview ID should be new to the catalogue fixture');
const preview = await fetchTmdbMovie(1575393, 'tmdb-key');
assert.equal(preview?.title, 'A Runaway Bride for Christmas', 'A valid new TMDB ID should proceed to TMDB preview');
assert.equal(branch.movies.some((entry) => entry.tmdbId === canonicalMovies[0].tmdbId), true, 'Existing TMDB IDs remain available for duplicate detection');
const commitResult = await commitMoviesToGitHub([movie], 'base-sha', 'Add Christmas movie: A Preview Christmas', { token: 'token', owner: 'owner', repo: 'repo', branch: 'main' });
assert.equal(commitResult.commitSha, 'new-commit');
assert.equal(commitCreateCalls, 1, 'one batch creates one GitHub commit');
globalThis.fetch = originalFetch;

console.log('Admin movie parsing, canonical shaping, and one-commit GitHub workflow tests passed.');
