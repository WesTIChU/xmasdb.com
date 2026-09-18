import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestTmdbMovie, normalizeMovieCrew, normalizeMovieReleaseDates, normalizeMovieVideos, normalizeStoredMovie, normalizeTmdbMovie, TMDB_MOVIE_APPEND } from './tmdb-movie.js';
import { savePersonCache } from './enrich-cast.js';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function holidayHeartsResponse() {
  return {
    id: 638806,
    title: 'Holiday Hearts',
    original_title: 'Holiday Hearts',
    release_date: '2019-11-23',
    overview: 'A holiday romance.',
    poster_path: '/holiday-hearts-poster.jpg',
    backdrop_path: '/holiday-hearts-backdrop.jpg',
    external_ids: { imdb_id: 'tt000638806' },
    release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ release_date: '2019-11-23', type: 3 }] }] },
    credits: {
      cast: [{ id: 101, name: 'Sample Actor', character: 'Peyton', order: 0, profile_path: '/sample-person.jpg' }],
      crew: [{ id: 201, name: 'Sample Director', job: 'Director' }]
    },
    videos: {
      results: [
        { site: 'YouTube', key: 'clip', type: 'Clip', official: true },
        { site: 'YouTube', key: 'IJWOTp9ta6c', name: 'Holiday Hearts Trailer | Countdown to Christmas', type: 'Trailer', official: true }
      ]
    }
  };
}

test('shared movie ingestion fetches and normalizes complete Holiday Hearts metadata', async () => {
  let request;
  const data = holidayHeartsResponse();
  const result = await ingestTmdbMovie(638806, {
    token: 'fixture-token',
    existing: { premiereDate: '2019-11-23', hallmarkTitle: 'Holiday Hearts' },
    personCache: {},
    fetcher: async (endpoint, params) => {
      request = { endpoint, params };
      return { data };
    },
    castEnricher: async cast => cast.map(person => ({ ...person, profile: '/images/people/101.webp' })),
    imageEnsurer: async ({ kind, id }) => ({ status: 'cached', path: `/images/${kind}s/${id}.webp` })
  });

  assert.deepEqual(request, { endpoint: 'movie/638806', params: { append_to_response: TMDB_MOVIE_APPEND } });
  assert.equal(result.movie.videos[0].key, 'IJWOTp9ta6c');
  assert.equal(result.movie.cast[0].name, 'Sample Actor');
  assert.equal(result.movie.imdbId, 'tt000638806');
  assert.equal(result.movie.release_dates[0].country, 'US');
  assert.equal(result.movie.poster, '/images/posters/638806.webp');
  assert.equal(result.movie.backdrop, '/images/backdrops/638806.webp');
  assert.equal(result.movie.premiereDate, '2019-11-23');
});

test('empty refresh data preserves valid local trailer, cast, artwork, and manual premiere', () => {
  const existing = {
    videos: [{ site: 'YouTube', key: 'existing', type: 'Trailer', official: true }],
    cast: [{ id: 101, name: 'Existing Actor', character: 'Peyton' }],
    poster: '/images/posters/638806.webp',
    backdrop: '/images/backdrops/638806.webp',
    premiereDate: '2019-11-23',
    imdbId: 'tt000638806'
  };
  const result = normalizeTmdbMovie({ id: 638806, title: 'Holiday Hearts', credits: { cast: [] }, videos: { results: [] } }, { existing });
  assert.deepEqual(result.videos, [{ key: 'existing', site: 'YouTube', type: 'Trailer', name: '', official: true }]);
  assert.deepEqual(result.cast, [{ id: 101, name: 'Existing Actor', character: 'Peyton', order: 0, profile_path: null, birthday: null, deathday: null }]);
  assert.equal(result.poster, existing.poster);
  assert.equal(result.backdrop, existing.backdrop);
  assert.equal(result.premiereDate, existing.premiereDate);
  assert.equal(result.imdbId, existing.imdbId);
});

test('canonical normalization keeps only the safe movie metadata schema', () => {
  const movie = normalizeStoredMovie({
    cast: [{ id: 1, name: 'Actor', character: 'Lead', order: 0, profile_path: '/actor.webp', profile: '/actor.webp', birthday: '1980-01-01', deathday: null }],
    crew: [{ adult: false, gender: 2, id: 2, name: 'Director', job: 'Director', credit_id: 'credit', popularity: 1, profile_path: '/crew.jpg' }],
    videos: [{ iso_639_1: 'en', iso_3166_1: 'US', key: 'trailer', site: 'YouTube', type: 'Trailer', name: 'Trailer', official: true, id: 'video', published_at: '2026-01-01' }],
    release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'G', descriptors: ['x'], iso_639_1: 'en', note: 'note', release_date: '2026-10-17T00:00:00.000Z', type: 6 }] }] },
    lastTmdbRefresh: '2026-01-01T00:00:00.000Z'
  });
  assert.deepEqual(movie.cast[0], { id: 1, name: 'Actor', character: 'Lead', order: 0, profile_path: '/actor.webp', birthday: '1980-01-01', deathday: null });
  assert.deepEqual(movie.crew[0], { id: 2, name: 'Director', job: 'Director', credit_id: 'credit' });
  assert.deepEqual(movie.videos[0], { key: 'trailer', site: 'YouTube', type: 'Trailer', name: 'Trailer', official: true });
  assert.deepEqual(movie.release_dates, [{ country: 'US', release_date: '2026-10-17T00:00:00.000Z', type: 6, certification: 'G', note: 'note' }]);
  assert.equal('lastTmdbRefresh' in movie, false);
});

test('shared normalizer produces reduced crew, release-date, and video fields for TMDB imports', () => {
  const result = normalizeTmdbMovie({
    id: 1,
    title: 'Example',
    credits: { cast: [], crew: [{ adult: false, id: 2, name: 'Director', job: 'Director', credit_id: 'credit', popularity: 9 }] },
    release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ release_date: '2026-01-01', type: 6 }] }] },
    videos: { results: [{ key: 'key', site: 'YouTube', type: 'Trailer', name: 'Trailer', official: true, id: 'id', published_at: 'date' }] }
  }, { castEnricher: null });
  assert.deepEqual(result.crew, normalizeMovieCrew([{ id: 2, name: 'Director', job: 'Director', credit_id: 'credit' }]));
  assert.deepEqual(result.release_dates, normalizeMovieReleaseDates({ results: [{ iso_3166_1: 'US', release_dates: [{ release_date: '2026-01-01', type: 6 }] }] }));
  assert.deepEqual(result.videos, normalizeMovieVideos([{ key: 'key', site: 'YouTube', type: 'Trailer', name: 'Trailer', official: true }]));
});

test('reapplying the shared normalizer is idempotent and never restores removed fields', () => {
  const input = {
    cast: [{ id: 1, name: 'Actor', character: 'Lead', order: 0, profile_path: '/actor.webp', profile: '/legacy.webp', birthday: '1980-01-01', deathday: null }],
    crew: [{ id: 2, name: 'Director', job: 'Director', credit_id: 'credit', adult: false, gender: 2, profile_path: '/crew.jpg' }],
    release_dates: [{ country: 'US', release_date: '2026-10-17T00:00:00.000Z', type: 6, certification: '', note: '' }],
    videos: [{ key: 'key', site: 'YouTube', type: 'Trailer', name: 'Trailer Name', official: true, id: 'video', published_at: 'date' }],
    lastTmdbRefresh: '2026-01-01T00:00:00.000Z'
  };
  const once = normalizeStoredMovie(input);
  const twice = normalizeStoredMovie(once);
  assert.deepEqual(twice, once);
  assert.deepEqual(Object.keys(once.cast[0]).sort(), ['birthday', 'character', 'deathday', 'id', 'name', 'order', 'profile_path']);
  assert.deepEqual(Object.keys(once.crew[0]).sort(), ['credit_id', 'id', 'job', 'name']);
  assert.deepEqual(Object.keys(once.videos[0]).sort(), ['key', 'name', 'official', 'site', 'type']);
  assert.equal('lastTmdbRefresh' in once, false);
});

test('crew normalization is deterministic, preserves legitimate jobs, and removes exact duplicates', () => {
  const input = [
    { id: '2', name: 'Writer', job: 'Writer', credit_id: 'writer' },
    { id: 1, name: 'Director', job: 'Director', credit_id: 'director' },
    { id: 2, name: 'Writer', job: 'Writer', credit_id: 'writer' },
    { id: 2, name: 'Writer', job: 'Writer', credit_id: 'writer-2' }
  ];
  const expected = [
    { id: 1, name: 'Director', job: 'Director', credit_id: 'director' },
    { id: 2, name: 'Writer', job: 'Writer', credit_id: 'writer' },
    { id: 2, name: 'Writer', job: 'Writer', credit_id: 'writer-2' }
  ];
  assert.deepEqual(normalizeMovieCrew(input), expected);
  assert.deepEqual(normalizeMovieCrew([...input].reverse()), expected);
});

test('stored crew in a different order has the same canonical representation', () => {
  const stored = [
    { id: 2, name: 'Writer', job: 'Writer', credit_id: 'writer' },
    { id: 1, name: 'Director', job: 'Director', credit_id: 'director' }
  ];
  const tmdb = [
    { id: 1, name: 'Director', job: 'Director', credit_id: 'director' },
    { id: 2, name: 'Writer', job: 'Writer', credit_id: 'writer' }
  ];
  assert.deepEqual(normalizeMovieCrew(stored), normalizeMovieCrew(tmdb));
});

test('crew changes detect new credits while incomplete responses preserve existing crew', () => {
  const existing = {
    crew: [{ id: 1, name: 'Director', job: 'Director', credit_id: 'director' }]
  };
  const added = normalizeTmdbMovie({
    id: 1,
    title: 'Example',
    credits: { crew: [...existing.crew, { id: 2, name: 'Writer', job: 'Writer', credit_id: 'writer' }] }
  }, { existing, castEnricher: null });
  const incomplete = normalizeTmdbMovie({ id: 1, title: 'Example', credits: {} }, { existing, castEnricher: null });
  assert.notDeepEqual(added.crew, existing.crew);
  assert.deepEqual(incomplete.crew, normalizeMovieCrew(existing.crew));
});

test('the same shared normalization supports Collection and Coming Soon status', async () => {
  const data = holidayHeartsResponse();
  const fetcher = async () => ({ data });
  const castEnricher = async cast => cast;
  const imageEnsurer = async ({ kind, id }) => ({ status: 'cached', path: `/images/${kind}s/${id}.webp` });
  const [collection, upcoming] = await Promise.all([
    ingestTmdbMovie(638806, { token: 'fixture-token', status: 'collection', fetcher, castEnricher, imageEnsurer }),
    ingestTmdbMovie(638806, { token: 'fixture-token', status: 'upcoming', fetcher, castEnricher, imageEnsurer })
  ]);
  assert.equal(collection.movie.status, 'collection');
  assert.equal(upcoming.movie.status, 'upcoming');
  assert.equal(collection.movie.cast.length, upcoming.movie.cast.length);
  assert.deepEqual(collection.movie.videos, upcoming.movie.videos);
  assert.ok(upcoming.movie.release_dates.length > 0);
});

test('manager refresh delegates to shared ingestion and preserves manual movie fields', async () => {
  const source = await readFile(new URL('../manage-server.js', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/manage/refresh-movie'");
  const end = source.indexOf("async function addMovieFromTmdb", start);
  const endpoint = source.slice(start, end);
  assert.match(endpoint, /ingestTmdbMovie\(tmdbId/);
  assert.doesNotMatch(endpoint, /fetchFromTmdb\(`movie\/\$\{tmdbId\}/);
  assert.doesNotMatch(endpoint, /current\[index\] = \{\s*\.\.\.existing/);

  const data = holidayHeartsResponse();
  const result = await ingestTmdbMovie(638806, {
    token: 'fixture-token',
    existing: {
      premiereDate: '2026-12-24',
      hallmarkTitle: 'Manual Holiday Hearts',
      status: 'collection'
    },
    status: 'collection',
    fetcher: async () => ({ data }),
    castEnricher: async cast => cast,
    imageEnsurer: async ({ kind, id }) => ({ status: 'cached', path: `/images/${kind}s/${id}.webp` })
  });

  assert.equal(result.movie.status, 'collection');
  assert.equal(result.movie.originalTitle, 'Holiday Hearts');
  assert.equal(result.movie.premiereDate, '2026-12-24');
  assert.equal(result.movie.hallmarkTitle, 'Manual Holiday Hearts');
  assert.equal(result.movie.cast.length, 1);
});

test('person-cache save is a no-op when serialized data is unchanged', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xmasdb-person-cache-'));
  const cache = { '101': { id: 101, name: 'Sample Actor', fetchedFromTmdb: true } };
  savePersonCache(cache, root);
  const file = path.join(root, 'person-cache.json');
  const before = await readFile(file, 'utf8');
  const beforeTime = (await stat(file)).mtimeMs;
  assert.equal(savePersonCache(cache, root), false);
  assert.equal(await readFile(file, 'utf8'), before);
  assert.equal((await stat(file)).mtimeMs, beforeTime);
});
