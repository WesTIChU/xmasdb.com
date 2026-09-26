import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { parseRoute } from '../src/App';
import { getFingerprintById } from '../src/data/fingerprints';
import { getMovieFingerprintIds, getRelatedMovieFingerprints } from '../src/data/movie-fingerprints';
import { MOVIES } from '../src/data/movies';
import { MovieDetail } from '../src/components/MovieDetail';
import { buildFingerprintListing, buildMovieDetail } from '../src/server/catalogue-api';
import { getServerSeo } from '../src/server/seo';
import { parseCatalogueQuery } from '../src/utils/catalogue-pagination';
import { getFingerprintPath } from '../src/utils/urls';

const football = getFingerprintById('football');
assert.deepEqual(football, { id: 'football', label: 'Football', category: 'World / Lifestyle' }, 'canonical fingerprint lookup returns the definition');

const footballListing = buildFingerprintListing(parseCatalogueQuery(''), 'football');
assert.ok(footballListing, 'known fingerprint produces a listing');
assert.ok(footballListing.movies.some((movie) => movie.title === 'Holiday Touchdown: A Bears Love Story'));
assert.ok(footballListing.relatedFingerprints.every((fingerprint) => fingerprint.id !== 'football'), 'related fingerprints exclude the current fingerprint');
assert.equal(buildFingerprintListing(parseCatalogueQuery(''), 'not-a-fingerprint'), null, 'unknown fingerprint has no listing');

const unclassifiedMovie = MOVIES.find((movie) => getMovieFingerprintIds(movie).length === 0);
assert.ok(unclassifiedMovie, 'prototype leaves most movies unclassified');
assert.equal(footballListing.movies.some((movie) => movie.id === unclassifiedMovie.id), false, 'unclassified movies are excluded from fingerprint listings');

assert.equal(parseRoute('/fingerprint/football/').type, 'fingerprint');
assert.equal(parseRoute('/fingerprint/not-a-fingerprint/').type, 'not-found');
assert.equal(getServerSeo(getFingerprintPath('football')).canonicalPath, getFingerprintPath('football'));
assert.match(getServerSeo(getFingerprintPath('football')).title, /Football/);

const fingerprintMovie = MOVIES.find((movie) => movie.id === 'uptv-2026-christmas-en-pointe')!;
const fingerprintPayload = buildMovieDetail(String(fingerprintMovie.tmdbId), fingerprintMovie.slug)!;
assert.deepEqual(fingerprintPayload.movie.fingerprints, ['small-town', 'returns-home', 'old-flame', 'second-chance', 'save-the-business']);
const fingerprintHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(MovieDetail, { movie: fingerprintPayload.movie, related: [], onNavigate: () => undefined }));
assert.match(fingerprintHtml, /Christmas Ingredients/);
assert.match(fingerprintHtml, /Small Town/);
assert.equal(fingerprintHtml.includes(getFingerprintPath('small-town')), true);
const related = getRelatedMovieFingerprints([
  { id: 'one', fingerprints: ['small-town', 'bakery'] },
  { id: 'two', fingerprints: ['small-town', 'returns-home'] },
  { id: 'three', fingerprints: ['bakery'] },
], 'small-town');
assert.deepEqual(related.map((fingerprint) => fingerprint.id), ['bakery', 'returns-home']);

const plainMovie = MOVIES.find((movie) => getMovieFingerprintIds(movie).length === 0)!;
const plainPayload = buildMovieDetail(String(plainMovie.tmdbId), plainMovie.slug)!;
const plainHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(MovieDetail, { movie: plainPayload.movie, related: [], onNavigate: () => undefined }));
assert.equal(plainHtml.includes('Christmas Ingredients'), false, 'movies without Christmas ingredients do not render an empty section');

console.log('Movie fingerprint vocabulary, filtering, routes, SEO, and rendering tests passed.');
