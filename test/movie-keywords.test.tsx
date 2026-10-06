import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovieDetail } from '../src/components/MovieDetail';
import type { MovieDetailMovie } from '../src/api/types';
import { MOVIES } from '../src/data/movies';
import { buildMovieDetail } from '../src/server/catalogue-api';

console.log('Running movie keyword rendering tests...');

const movie = {
  id: 'keyword-movie', slug: 'keyword-movie', title: 'Keyword Movie', year: 2026,
  brandId: 'hallmark', releaseDate: '2026-12-01', synopsis: 'Synopsis', posterUrl: '', cast: [],
  tmdbId: 123, fingerprints: ['family-business', 'restaurant-cafe', 'save-the-business'], keywords: [
    { id: 1, name: 'small town' }, { id: 2, name: 'holiday' }, { id: 3, name: 'restaurant' },
    { name: 'family business', evidence: 'family restaurant' }, { name: 'café', evidence: 'family café' },
    { name: 'lawyer', evidence: 'lawyer' }, { name: 'demolition', evidence: 'demolition' }, { name: 'save the business', evidence: 'save the business' },
  ],
  writingCredits: [],
} satisfies MovieDetailMovie;

const markup = renderToStaticMarkup(<MovieDetail movie={movie} related={[]} onNavigate={() => undefined} />);
assert.match(markup, /Family Business.*Restaurant\/Café.*Save the Business/s, 'overlapping concepts remain visible in Christmas Ingredients');
assert.doesNotMatch(markup, /family restaurant/, 'Jev evidence is not displayed publicly');
assert.doesNotMatch(markup, /id="keywords-heading"/, 'stored keywords do not render a public Keywords section');
assert.doesNotMatch(markup, /\bsmall town\b|\blawyer\b|\bdemolition\b/, 'stored TMDB and Jev keywords are publicly hidden');
assert.equal(movie.keywords?.length, 8, 'overlapping TMDB and Jev concepts remain stored');

const storedKeywordMovie = MOVIES.find((catalogueMovie) => catalogueMovie.keywords?.length);
assert.ok(storedKeywordMovie, 'catalogue retains stored keyword data for regression coverage');
const publicDetail = buildMovieDetail(storedKeywordMovie.tmdbId.toString(), storedKeywordMovie.slug);
assert.ok(publicDetail && !('keywords' in publicDetail.movie), 'public movie detail payload omits stored keywords while the feature is disabled');

const withoutKeywords = renderToStaticMarkup(<MovieDetail movie={{ ...movie, keywords: [] }} related={[]} onNavigate={() => undefined} />);
assert.doesNotMatch(withoutKeywords, /id="keywords-heading"/, 'movie pages have no public Keywords section');

console.log('Movie keyword rendering tests passed.');
