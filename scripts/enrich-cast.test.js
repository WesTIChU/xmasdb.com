import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildCastData, enrichCastData, fetchTmdbPerson, inspectMovieCast, rebuildAllCastFromTmdb, refreshActorsFromTmdb } from './enrich-cast.js';
import { getActorUrl } from '../src/js/movie-url.js';

const credits = Array.from({ length: 22 }, (_, index) => ({
  id: index + 1,
  name: index < 2 ? 'Same Name' : `Actor ${index + 1}`,
  character: index % 2 ? '' : 'Supporting Character',
  order: index,
  profile_path: null
}));
credits.push({ ...credits[0], character: 'Another role', order: 22 });

function fixture(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-pipeline-'));
  fs.mkdirSync(path.join(rootDir, 'public'));
  fs.mkdirSync(path.join(rootDir, 'dist'));
  const write = (name, data) => fs.writeFileSync(path.join(rootDir, name), JSON.stringify(data));
  write('movies.json', [{ tmdbId: 1545999, tmdb_id: 1545999, title: 'Christmas at the Catnip Café', cast: credits.slice(0, 2) }, { tmdb_id: 42, title: 'Second Movie', cast: [credits[0]] }]);
  write('upcoming.json', []);
  write('cast.json', { actors: [], castByMovieId: { 1545999: credits.slice(0, 2) }, movieCast: { 1545999: [credits[0]] } });
  write('cast-seed.json', { 1545999: ['Wrong seed'] });
  write('person-cache.json', { 1: { id: 1, name: 'Stale', profile_path: null, fetchedFromTmdb: true } });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  return { rootDir, write, read: name => JSON.parse(fs.readFileSync(path.join(rootDir, name), 'utf8')) };
}

function mockTmdb(t, failEndpoint = '') {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    const endpoint = new URL(url).pathname.replace('/3/', '');
    calls.push(endpoint);
    if (endpoint === failEndpoint) return new Response('{}', { status: 404 });
    if (endpoint.startsWith('movie/')) {
      const id = Number(endpoint.split('/')[1]);
      return Response.json({ id, cast: id === 1545999 ? credits : [credits[0]] });
    }
    const id = Number(endpoint.split('/')[1]);
    if (endpoint.endsWith('/images')) return Response.json({ profiles: id === 2 ? [{ file_path: '/recovered.jpg' }] : [] });
    return Response.json({ id, name: id < 3 ? 'Same Name' : `Actor ${id}`, birthday: id === 1 ? '1980-01-01' : null, deathday: null, profile_path: id === 1 ? '/person.jpg' : null });
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

test('retains every credit, empty roles, repeated appearances, order and distinct same-name IDs', () => {
  const result = buildCastData([{ tmdbId: 1545999 }], { 1545999: credits });
  assert.equal(result.castByMovieId[1545999].length, 23);
  assert.deepEqual(result.castByMovieId[1545999].map(p => [p.id, p.character, p.order]), credits.map(p => [p.id, p.character, p.order]));
  assert.equal(result.actors.length, 22);
  assert.equal(result.actors.find(p => p.id === 1).count, 1);
  assert.equal(result.actors.find(p => p.id === 2).name, 'Same Name');
});

test('canonical movie.cast is the source for subsequent regeneration', t => {
  const f = fixture(t);
  const initial = enrichCastData(null, {}, f.rootDir);
  assert.equal(initial.castByMovieId[1545999].length, 2);
  enrichCastData({ 1545999: credits }, {}, f.rootDir);
  const result = enrichCastData(null, {}, f.rootDir);
  assert.equal(result.castByMovieId[1545999].length, 2);
  assert.deepEqual(f.read('public/cast.json'), result);
  assert.deepEqual(f.read('dist/cast.json'), result);
});

function canonicalFixture(t, { movies = [], upcoming = [], cache = {}, staleCast = {} } = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-cast-'));
  fs.mkdirSync(path.join(rootDir, 'public'));
  fs.mkdirSync(path.join(rootDir, 'dist'));
  const write = (name, data) => fs.writeFileSync(path.join(rootDir, name), JSON.stringify(data));
  write('movies.json', movies);
  write('upcoming.json', upcoming);
  write('cast.json', { actors: [], castByMovieId: staleCast, movieCast: staleCast });
  write('cast-seed.json', {});
  write('person-cache.json', cache);
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

test('Collection movie.cast appears in generated cast data', t => {
  const rootDir = canonicalFixture(t, { movies: [{ tmdbId: 1, title: 'Collection Movie', cast: [{ id: 10, name: 'Collection Actor', character: 'Lead', order: 0 }] }] });
  const data = enrichCastData(null, {}, rootDir);
  assert.deepEqual(data.castByMovieId['1'].map(person => person.id), [10]);
  assert.equal(data.actors[0].movieTmdbIds[0], 1);
});

test('approved Coming Soon movie.cast appears in generated cast data', t => {
  const rootDir = canonicalFixture(t, { upcoming: [{ tmdbId: 2, title: 'Coming Soon Movie', cast: [{ id: 20, name: 'Coming Actor', character: 'Lead', order: 0 }] }] });
  const data = enrichCastData(null, {}, rootDir);
  assert.deepEqual(data.castByMovieId['2'].map(person => person.id), [20]);
  assert.equal(data.actors[0].movieTmdbIds[0], 2);
});

test('an actor existing only in approved Coming Soon is not dropped', t => {
  const rootDir = canonicalFixture(t, { upcoming: [{ tmdbId: 3, title: 'Upcoming Only', cast: [{ id: 30, name: 'Upcoming Only Actor' }] }] });
  const data = enrichCastData(null, {}, rootDir);
  assert.equal(data.actors.find(actor => actor.id === 30).count, 1);
});

test('Coming Soon to Collection deduplicates one actor filmography entry', t => {
  const movie = { tmdbId: 4, title: 'Moved Movie', cast: [{ id: 40, name: 'Moved Actor' }] };
  const rootDir = canonicalFixture(t, { movies: [movie], upcoming: [{ ...movie, status: 'upcoming' }] });
  const data = enrichCastData(null, {}, rootDir);
  assert.deepEqual(data.actors.find(actor => actor.id === 40).movieTmdbIds, [4]);
  assert.equal(data.totalMovies, 1);
});

test('stale cast.json omission is restored from canonical movie.cast', t => {
  const rootDir = canonicalFixture(t, { movies: [{ tmdbId: 5, title: 'Restored Movie', cast: [{ id: 50, name: 'Restored Actor' }] }], staleCast: { 5: [] } });
  const data = enrichCastData(null, {}, rootDir);
  assert.equal(data.castByMovieId['5'][0].id, 50);
  assert.equal(data.actors[0].id, 50);
});

test('person-cache actors without current public movie references are excluded', t => {
  const rootDir = canonicalFixture(t, { movies: [{ tmdbId: 6, title: 'Other Movie', cast: [] }], cache: { 60: { id: 60, name: 'Cached Only Actor', profile_path: '/images/people/60.webp' } } });
  const data = enrichCastData(null, {}, rootDir);
  assert.equal(data.actors.some(actor => actor.id === 60), false);
});

test('raw inspection logs every record and all missing IDs without writing', async t => {
  const f = fixture(t);
  mockTmdb(t);
  const before = f.read('cast.json');
  const logs = [];
  await inspectMovieCast({ token: 'test-token', rootDir: f.rootDir, log: line => logs.push(line) });
  assert.ok(logs.includes('TMDB CAST COUNT: 23'));
  assert.ok(logs.includes('cast.json contains: 2 cast members'));
  assert.equal(logs.filter(line => line.startsWith('{')).length, 23);
  for (let id = 3; id <= 22; id++) assert.ok(logs.includes(`${id} - Actor ${id}`));
  assert.deepEqual(f.read('cast.json'), before);
});

test('full rebuild deduplicates person requests only, refreshes cache and verifies all output copies', async t => {
  const f = fixture(t);
  const calls = mockTmdb(t);
  const result = await rebuildAllCastFromTmdb({ token: 'test-token', rootDir: f.rootDir, log: () => {} });
  assert.equal(result.moviesProcessed, 2);
  assert.equal(result.tmdbCastRecordsReturned, 24);
  assert.equal(result.castRecordsWritten, 24);
  assert.equal(result.uniquePeople, 22);
  assert.equal(result.peopleEnriched, 22);
  assert.equal(result.birthdaysFound, 1);
  assert.equal(result.photosFound, 2);
  assert.equal(result.photosRecoveredThroughImages, 1);
  assert.equal(result.peopleGenuinelyWithoutPhotos, 20);
  assert.equal(result.apiFailures, 0);
  assert.equal(calls.filter(p => p === 'person/1').length, 1);
  assert.equal(calls.filter(p => p === 'movie/1545999/credits').length, 1);
  assert.equal(calls.filter(p => /^person\/\d+$/.test(p)).length, 22);
  assert.equal(f.read('person-cache.json')[1].name, 'Same Name');
  assert.equal(f.read('cast.json').castByMovieId[1545999][1].profile_path, '/recovered.jpg');
  assert.deepEqual(f.read('public/cast.json'), f.read('cast.json'));
  assert.deepEqual(f.read('dist/cast.json'), f.read('cast.json'));
});

test('forced person refresh bypasses complete caches and deduplicates supplied IDs', async t => {
  const f = fixture(t);
  const calls = mockTmdb(t);
  f.write('person-cache.json', { 1: { id: 1, name: 'Stale', profile_path: null, fetchedFromTmdb: true, enrichmentVersion: 2 } });
  const result = await refreshActorsFromTmdb({ token: 'test-token', rootDir: f.rootDir, personIds: [1, 1] });
  assert.equal(result.updated, 1);
  assert.equal(calls.filter(p => p === 'person/1').length, 1);
  assert.equal(f.read('person-cache.json')[1].profile_path, '/person.jpg');
  assert.equal(f.read('cast.json').castByMovieId[1545999].length, 2);
});

test('failed person or image APIs cannot publish an incomplete rebuild or count missing photos as genuine', async t => {
  const f = fixture(t);
  mockTmdb(t, 'person/2/images');
  const before = f.read('cast.json');
  const cacheBefore = f.read('person-cache.json');
  await assert.rejects(rebuildAllCastFromTmdb({ token: 'test-token', rootDir: f.rootDir, log: () => {} }), err => {
    assert.equal(err.report.apiFailures, 1);
    assert.equal(err.report.castRecordsWritten, 0);
    assert.equal(err.report.peopleGenuinelyWithoutPhotos, 0);
    return true;
  });
  assert.deepEqual(f.read('cast.json'), before);
  assert.deepEqual(f.read('person-cache.json'), cacheBefore);
});

test('person failures do not return old cached data as a successful refresh', async t => {
  mockTmdb(t, 'person/1');
  await assert.rejects(fetchTmdbPerson(1, 'test-token', { 1: { id: 1, name: 'Stale' } }, true), /HTTP 404/);
});

test('canonical IDs are validated instead of joining titles, positions or slugs', () => {
  assert.throws(() => buildCastData([{ title: '1545999' }], {}), /valid TMDB ID/);
  assert.throws(() => buildCastData([{ tmdbId: 1, tmdb_id: 2 }], {}), /Conflicting/);
  assert.throws(() => buildCastData([{ tmdbId: 1 }, { tmdb_id: 1 }], {}), /Duplicate/);
  const result = buildCastData([{ tmdbId: 1 }], { 1: [{ id: 99, name: 'Same Name' }] }, { 1: { id: 1, name: 'Same Name' } });
  assert.equal(result.castByMovieId[1][0].id, 99);
});

test('existing movie renderer produces one linked card per credit including no-photo and empty-character records', () => {
  const source = fs.readFileSync(new URL('../src/js/movie.js', import.meta.url), 'utf8');
  const start = source.indexOf('  function renderCastGrid(');
  const end = source.indexOf('\n  // Helper:', start);
  assert.ok(start > 0 && end > start);
  const element = () => ({ children: [], style: {}, setAttribute() {}, addEventListener() {}, appendChild(child) { this.children.push(child); } });
  const grid = element();
  const section = element();
  const context = {
    document: { getElementById: id => id === 'cast-grid' ? grid : section, createElement: element },
    castData: { actors: [] },
    getActorUrl,
    getActorProfileImageUrl: p => p || 'placeholder',
    formatCastCardSubtitle: character => character,
    PLACEHOLDER_ACTOR_PHOTO: 'placeholder',
    credits
  };
  vm.runInNewContext(`${source.substring(start, end)}\nrenderCastGrid(credits);`, context);
  assert.equal(grid.children.length, credits.length);
  grid.children.forEach((card, index) => {
    const slug = credits[index].name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-');
    assert.equal(card.href, `/actor/${credits[index].id}/${slug}`);
  });
});
