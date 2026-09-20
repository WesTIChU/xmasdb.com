import assert from 'node:assert/strict';
import { getAllActors } from '../src/data/actors';
import { MOVIES } from '../src/data/movies';
import { buildSearchIndex, buildSearchResults } from '../src/server/catalogue-api';
import {
  normalizeSearchText,
  scoreActorSearchResult,
  scoreMovieSearchEntry,
} from '../src/utils/search-relevance';

const index = buildSearchIndex();

const paulActors = index.people
  .map((actor) => ({ actor, score: scoreActorSearchResult(actor, 'paul') }))
  .filter((result) => result.score > 0)
  .sort((a, b) => b.score - a.score || b.actor.movieCount - a.actor.movieCount);
const paulMovies = index.movies
  .map((movie) => ({ movie, score: scoreMovieSearchEntry(movie, 'paul') }))
  .filter((result) => result.score > 0)
  .sort((a, b) => b.score - a.score);

assert.ok(paulActors.length > 0, 'paul should find actor name matches');
assert.ok(paulMovies.length > 0, 'paul should retain indirect movie matches');
assert.ok(paulActors[0].score > paulMovies[0].score, 'direct actor names must beat indirect movie matches');
assert.equal(buildSearchResults('paul').actors[0].name, paulActors[0].actor.name);

const exactMovie = MOVIES[0];
assert.equal(buildSearchResults(exactMovie.title).movies[0].tmdbId, exactMovie.tmdbId);

const actorWithMultipleWords = getAllActors().find((actor) => actor.name.trim().split(/\s+/).length >= 2)!;
const actorParts = normalizeSearchText(actorWithMultipleWords.name).split(' ');
assert.ok(buildSearchResults(actorParts[0]).actors.some((actor) => actor.tmdbPersonId === actorWithMultipleWords.tmdbPersonId));
assert.ok(buildSearchResults(actorParts[actorParts.length - 1]).actors.some((actor) => actor.tmdbPersonId === actorWithMultipleWords.tmdbPersonId));
assert.ok(buildSearchResults('PAUL').actors.length > 0, 'mixed case should match');

const punctuatedActor = getAllActors().find((actor) => /[.'-]/.test(actor.name));
if (punctuatedActor) {
  const firstToken = normalizeSearchText(punctuatedActor.name).split(' ')[0];
  assert.ok(buildSearchResults(firstToken).actors.some((actor) => actor.tmdbPersonId === punctuatedActor.tmdbPersonId));
}

assert.deepEqual(buildSearchResults('zzzz-no-match-123'), { movies: [], actors: [] });
console.log('Search relevance and normalization tests passed.');
