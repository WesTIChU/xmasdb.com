import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovieDetail } from '../src/components/MovieDetail';
import type { MovieDetailMovie } from '../src/api/types';

console.log('Running movie keyword rendering tests...');

const movie = {
  id: 'keyword-movie', slug: 'keyword-movie', title: 'Keyword Movie', year: 2026,
  brandId: 'hallmark', releaseDate: '2026-12-01', synopsis: 'Synopsis', posterUrl: '', cast: [],
  tmdbId: 123, fingerprints: [], keywords: [{ id: 1, name: 'small town' }, { id: 2, name: 'holiday' }],
  writingCredits: [],
} satisfies MovieDetailMovie;

const markup = renderToStaticMarkup(<MovieDetail movie={movie} related={[]} onNavigate={() => undefined} />);
assert.match(markup, /id="keywords-heading"/, 'movie pages render a Keywords section when keywords exist');
assert.match(markup, /small town.*holiday/s, 'TMDB keywords render as text pills');
assert.doesNotMatch(markup, /href="[^"]*small-town/, 'keyword pills are non-clickable');

const withoutKeywords = renderToStaticMarkup(<MovieDetail movie={{ ...movie, keywords: [] }} related={[]} onNavigate={() => undefined} />);
assert.doesNotMatch(withoutKeywords, /id="keywords-heading"/, 'movie pages hide Keywords when none exist');

console.log('Movie keyword rendering tests passed.');
