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

const markup = renderToStaticMarkup(<MovieDetail movie={{ ...base, certification: { value: 'G', country: 'US', source: 'tmdb', lastConfirmedAt: '2026-10-06T00:00:00.000Z' }, genres: [{ id: 10770, name: 'TV Movie' }, { id: 10749, name: 'Romance' }] }} related={[]} onNavigate={() => undefined} />);
assert.match(markup, /Certification/);
assert.match(markup, />G</, 'movie pages render the selected US certification');
assert.doesNotMatch(markup, />G \(US\)</, 'movie pages do not append the US country code');
assert.match(markup, /lucide-badge-check/, 'certification row renders a badge icon');
assert.match(markup, /lucide-tags/, 'genres row renders a tags icon');

const foreignCertification = renderToStaticMarkup(<MovieDetail movie={{ ...base, certification: { value: 'L', country: 'BR', source: 'tmdb', lastConfirmedAt: '2026-10-06T00:00:00.000Z' } }} related={[]} onNavigate={() => undefined} />);
assert.doesNotMatch(foreignCertification, />Certification<\/span>/, 'foreign certifications are not displayed');

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
