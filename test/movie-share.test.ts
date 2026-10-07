import assert from 'node:assert/strict';
import { MOVIES } from '../src/data/movies';
import { getMovieCanonicalUrl, getMoviePath } from '../src/utils/urls';

const movie = MOVIES.find((entry) => entry.tmdbId === 1191059)!;
const canonicalUrl = getMovieCanonicalUrl(movie.tmdbId, movie.slug);

assert.equal(movie.slug, 'merry-mystery-christmas');
assert.equal(getMoviePath(movie.tmdbId, movie.slug), '/movie/1191059/merry-mystery-christmas/');
assert.equal(canonicalUrl, 'https://xmasdb.com/movie/1191059/merry-mystery-christmas/');
assert.notEqual(canonicalUrl, 'https://xmasdb.com/movie/1191059/merry-mystery-christmas-2023/');

const sharePayload = {
  title: `${movie.title} on XmasDB`,
  url: canonicalUrl,
};
assert.equal(sharePayload.url, canonicalUrl, 'native share should use the canonical URL');
assert.equal(sharePayload.title, `${movie.title} on XmasDB`, 'native share should use the branded title');
assert.equal('text' in sharePayload, false, 'native share should not supply custom descriptive text');

const clipboardFallbackValue = canonicalUrl;
assert.equal(clipboardFallbackValue, canonicalUrl, 'clipboard fallback should contain only the canonical URL');

console.log('Movie share URL tests passed.');
