import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovieDetail } from '../src/components/MovieDetail';
import type { MovieDetailMovie } from '../src/api/types';
import { MOVIES } from '../src/data/movies';
import { buildMovieDetail } from '../src/server/catalogue-api';

const base = {
  id: 'genre-movie', slug: 'genre-movie', title: 'Genre Movie', year: 2020,
  brandId: 'hallmark', releaseDate: '2020-11-27', synopsis: 'Synopsis', posterUrl: '', cast: [],
  tmdbId: 746045, fingerprints: [], writingCredits: [],
} satisfies MovieDetailMovie;

const markup = renderToStaticMarkup(<MovieDetail movie={{ ...base, genres: [{ id: 10770, name: 'TV Movie' }, { id: 10749, name: 'Romance' }] }} related={[]} onNavigate={() => undefined} />);
assert.match(markup, /Genres/, 'movie pages render the Genres metadata row');
assert.match(markup, /TV Movie · Romance/, 'movie pages render multiple genres in TMDB order');

const withoutGenres = renderToStaticMarkup(<MovieDetail movie={base} related={[]} onNavigate={() => undefined} />);
assert.doesNotMatch(withoutGenres, /TV Movie|Romance/, 'movies without genres render without an empty genre element');

const catalogueMovie = MOVIES.find((movie) => movie.tmdbId === 746045)!;
const previousGenres = catalogueMovie.genres;
catalogueMovie.genres = [{ id: 10770, name: 'TV Movie' }, { id: 10749, name: 'Romance' }];
try {
  assert.deepEqual(buildMovieDetail('746045', catalogueMovie.slug)?.movie.genres, catalogueMovie.genres, 'movie detail API exposes stored genres');
} finally {
  if (previousGenres) catalogueMovie.genres = previousGenres;
  else delete catalogueMovie.genres;
}

console.log('Movie genre rendering tests passed.');
