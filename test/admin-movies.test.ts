import assert from 'node:assert/strict';
import { buildMovieFromTmdb, extractTmdbId, generateMoviesModule, normalizeBrand, normalizeStatus, parseBulkMovieInput } from '../src/server/movie-import';
import { commitMoviesToGitHub } from '../src/server/github-catalogue';

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

const originalFetch = globalThis.fetch;
const source = generateMoviesModule([]);
let commitCreateCalls = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  const method = init?.method || 'GET';
  if (url.endsWith('/git/ref/heads/main')) return new Response(JSON.stringify({ object: { sha: 'base-sha' } }), { status: 200 });
  if (url.includes('/git/commits/base-sha')) return new Response(JSON.stringify({ tree: { sha: 'tree-sha' } }), { status: 200 });
  if (url.includes('/contents/src/data/movies.ts')) return new Response(JSON.stringify({ content: Buffer.from(source).toString('base64') }), { status: 200 });
  if (method === 'POST' && url.endsWith('/git/commits')) { commitCreateCalls += 1; return new Response(JSON.stringify({ sha: 'new-commit' }), { status: 201 }); }
  if (method === 'POST' && url.endsWith('/git/blobs')) return new Response(JSON.stringify({ sha: 'blob-sha' }), { status: 201 });
  if (method === 'POST' && url.endsWith('/git/trees')) return new Response(JSON.stringify({ sha: 'new-tree' }), { status: 201 });
  if (method === 'PATCH' && url.includes('/git/refs/heads/main')) return new Response('{}', { status: 200 });
  return new Response('{}', { status: 404 });
};
const commitResult = await commitMoviesToGitHub([movie], 'base-sha', 'Add Christmas movie: A Preview Christmas', { token: 'token', owner: 'owner', repo: 'repo', branch: 'main' });
assert.equal(commitResult.commitSha, 'new-commit');
assert.equal(commitCreateCalls, 1, 'one batch creates one GitHub commit');
globalThis.fetch = originalFetch;

console.log('Admin movie parsing, canonical shaping, and one-commit GitHub workflow tests passed.');
