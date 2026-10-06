import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovieDetail } from '../src/components/MovieDetail';
import type { MovieDetailMovie } from '../src/api/types';
import { MOVIES } from '../src/data/movies';
import { buildMovieDetail } from '../src/server/catalogue-api';

const base = {
  id: 'certification-movie', slug: 'certification-movie', title: 'Certification Movie', year: 2020,
  brandId: 'hallmark', releaseDate: '2020-11-27', synopsis: 'Synopsis', posterUrl: '', cast: [],
  tmdbId: 746045, fingerprints: [], writingCredits: [],
} satisfies MovieDetailMovie;

const markup = renderToStaticMarkup(<MovieDetail movie={{ ...base, certification: { value: 'G', country: 'US', source: 'tmdb', lastConfirmedAt: '2026-10-06T00:00:00.000Z' } }} related={[]} onNavigate={() => undefined} />);
assert.match(markup, /Certification/);
assert.match(markup, />G \(US\)</, 'movie pages render the selected certification and country');

const withoutCertification = renderToStaticMarkup(<MovieDetail movie={base} related={[]} onNavigate={() => undefined} />);
assert.doesNotMatch(withoutCertification, />G \(US\)</, 'movies without certification render without an empty classification');

const catalogueMovie = MOVIES.find((movie) => movie.tmdbId === 746045)!;
const previousCertification = catalogueMovie.certification;
catalogueMovie.certification = { value: 'G', country: 'US', source: 'tmdb', lastConfirmedAt: '2026-10-06T00:00:00.000Z' };
try {
  assert.equal(buildMovieDetail('746045', catalogueMovie.slug)?.movie.certification?.value, 'G', 'movie detail API includes the stored certification');
} finally {
  if (previousCertification) catalogueMovie.certification = previousCertification;
  else delete catalogueMovie.certification;
}

console.log('Movie certification rendering tests passed.');
