import assert from 'node:assert/strict';
import { MOVIES } from '../src/data/movies';
import { getTmdbPersonIdForSlug } from '../src/data/actors';
import {
  buildPublicActorResponse,
  buildPublicActorsResponse,
  buildPublicIngredientResponse,
  buildPublicIngredientsResponse,
  buildPublicMoviesResponse,
} from '../src/server/public-movies-api';
import { getMovieFingerprints } from '../src/data/movie-fingerprints';

for (const network of ['hallmark', 'lifetime', 'gaf']) {
  const result = buildPublicMoviesResponse({ network, limit: '5' });
  assert.equal('error' in result, false, `${network} query is valid`);
  if ('error' in result) continue;
  assert.ok(result.count <= 5);
  assert.ok(result.movies.every((movie) => movie.network.toLowerCase() === network));
}

const yearResult = buildPublicMoviesResponse({ year: '2025', limit: '5' });
assert.equal('error' in yearResult, false, 'year query is valid');
if (!('error' in yearResult)) assert.ok(yearResult.movies.every((movie) => movie.year === 2025));

const combinedResult = buildPublicMoviesResponse({ network: 'hallmark', year: '2025', limit: '5' });
assert.equal('error' in combinedResult, false, 'combined query is valid');
if (!('error' in combinedResult)) {
  assert.ok(combinedResult.movies.every((movie) => movie.network === 'Hallmark' && movie.year === 2025));
  assert.deepEqual(Object.keys(combinedResult.movies[0] || {}).sort(), ['actors', 'christmas_ingredients', 'imdb_id', 'network', 'title', 'tmdb_id', 'xmasdb_url', 'year'].sort());
}

function assertError(query: Parameters<typeof buildPublicMoviesResponse>[0], message: string): void {
  const result = buildPublicMoviesResponse(query);
  assert.equal('error' in result, true);
  if ('error' in result) assert.equal(result.error, message);
}

assertError({ network: 'not-a-network' }, 'Invalid network parameter.');
assertError({ year: '20x5' }, 'Invalid year parameter.');
assertError({ actor: 'not-an-id' }, 'Invalid actor parameter.');
assertError({ ingredient: 'not-an-ingredient' }, 'Invalid ingredient parameter.');
assertError({ limit: '0' }, 'Invalid limit parameter. Use a whole number from 1 to 1000.');
assertError({ limit: '1001' }, 'Invalid limit parameter. Use a whole number from 1 to 1000.');
assertError({ limit: ['5'] }, 'Invalid limit parameter.');

const allResult = buildPublicMoviesResponse({});
assert.equal('error' in allResult, false);
if (!('error' in allResult)) assert.equal(allResult.count, Math.min(MOVIES.length, 1000));

const validActorId = getTmdbPersonIdForSlug(MOVIES[0].cast[0].slug);
const actorMovies = buildPublicMoviesResponse({ actor: String(validActorId), limit: '5' });
assert.equal('error' in actorMovies, false, 'actor filter is valid');
if (!('error' in actorMovies)) assert.ok(actorMovies.movies.every((movie) => movie.actors.some((actor) => actor.tmdb_id === validActorId)));
const unknownActorMovies = buildPublicMoviesResponse({ actor: '999999999', limit: '5' });
assert.equal('error' in unknownActorMovies, false);
if (!('error' in unknownActorMovies)) assert.equal(unknownActorMovies.count, 0);

const ingredientMovies = buildPublicMoviesResponse({ ingredient: 'small-town', limit: '5' });
assert.equal('error' in ingredientMovies, false, 'ingredient filter is valid');
if (!('error' in ingredientMovies)) assert.ok(ingredientMovies.movies.every((movie) => movie.christmas_ingredients.some((ingredient) => ingredient.id === 'small-town')));
const combinedIngredientMovies = buildPublicMoviesResponse({ network: 'hallmark', ingredient: 'small-town', limit: '5' });
assert.equal('error' in combinedIngredientMovies, false, 'combined ingredient filter is valid');

const noIngredientMovie = MOVIES.find((movie) => getMovieFingerprints(movie).length === 0)!;
const noIngredientResult = buildPublicMoviesResponse({ actor: String(getTmdbPersonIdForSlug(noIngredientMovie.cast[0].slug)), limit: '1000' });
assert.equal('error' in noIngredientResult, false);
if (!('error' in noIngredientResult)) {
  assert.ok(noIngredientResult.movies.some((movie) => movie.tmdb_id === noIngredientMovie.tmdbId && movie.christmas_ingredients.length === 0));
}

const actorsResult = buildPublicActorsResponse();
assert.ok(actorsResult.actors.length > 0);
assert.ok(actorsResult.actors.every((actor) => actor.xmasdb_movie_count > 0));
const actorDetail = buildPublicActorResponse(String(validActorId));
assert.equal('error' in (actorDetail || {}), false);
assert.ok(actorDetail && 'movies' in actorDetail && actorDetail.movies.length > 0);
const malformedActor = buildPublicActorResponse('bad-id');
assert.ok(malformedActor && 'error' in malformedActor);
if (malformedActor && 'error' in malformedActor) assert.equal(malformedActor.error, 'Invalid actor parameter.');
assert.equal(buildPublicActorResponse('999999999'), undefined);

const ingredientsResult = buildPublicIngredientsResponse();
assert.ok(ingredientsResult.ingredients.some((ingredient) => ingredient.id === 'small-town'));
const ingredientDetail = buildPublicIngredientResponse('small-town');
assert.ok(ingredientDetail && 'movies' in ingredientDetail && ingredientDetail.movies.length > 0);
assert.equal(buildPublicIngredientResponse('not-real'), undefined);
const malformedIngredient = buildPublicIngredientResponse('bad id');
assert.ok(malformedIngredient && 'error' in malformedIngredient);
if (malformedIngredient && 'error' in malformedIngredient) assert.equal(malformedIngredient.error, 'Invalid ingredient parameter.');

console.log('Public movies API filtering and validation tests passed.');
