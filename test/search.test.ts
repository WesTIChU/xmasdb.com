import assert from 'node:assert/strict';
import { getAllActors } from '../src/data/actors';
import { MOVIES } from '../src/data/movies';
import { buildSearchIndex, buildSearchResults } from '../src/server/catalogue-api';
import {
  getDisplayAlternativeTitles,
  getPublicAlternativeTitles,
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

const alternativeTitleMovie = MOVIES.find((movie) => movie.tmdbId === 878410)!;
const alternativeTitle = alternativeTitleMovie.alternativeTitles?.[0]?.title;
if (alternativeTitle) {
  const alternativeTitleResults = buildSearchResults(alternativeTitle);
  assert.ok(alternativeTitleResults.movies.some((movie) => movie.tmdbId === 878410), 'global search should match TMDB 878410 alternative title');
  assert.equal(alternativeTitleResults.movies.find((movie) => movie.tmdbId === 878410)?.title, alternativeTitleMovie.title, 'alternative-title search keeps the catalogue primary title');
}

const merryMysteryChristmas = MOVIES.find((movie) => movie.tmdbId === 1191059)!;
assert.equal(buildSearchResults('Merry Mystery Christmas').movies[0].tmdbId, 1191059, 'canonical title should find Merry Mystery Christmas');
const akaResults = buildSearchResults('A Very Curious Christmas');
assert.equal(akaResults.movies[0].tmdbId, 1191059, 'AKA title should find Merry Mystery Christmas');
assert.deepEqual(akaResults.movies[0].alternativeTitles, ['A Very Curious Christmas'], 'search result should expose the matching AKA title');
assert.equal(buildSearchResults('1191059').movies[0].tmdbId, 1191059, 'exact TMDB ID should find the movie');
assert.equal(buildSearchResults('1191059').movies[0].networkPremiereYear, 2025, 'exact TMDB ID result should include the differing network premiere year');
assert.ok(!buildSearchResults('11910').movies.some((movie) => movie.tmdbId === 1191059), 'partial TMDB ID should not match');
assert.equal(getDisplayAlternativeTitles('Merry Mystery Christmas', ['Merry Mystery Christmas', 'A Very Curious Christmas', 'A Very Curious Christmas']).join(' · '), 'A Very Curious Christmas');
const charmingChristmasTown = MOVIES.find((movie) => movie.tmdbId === 744933)!;
assert.deepEqual(getPublicAlternativeTitles(charmingChristmasTown.title, charmingChristmasTown.alternativeTitles), ['Christmas in Solvang'], 'foreign alternate titles must not be publicly selectable');
assert.ok(!buildSearchResults('Очаровательный рождественский городок').movies.some((movie) => movie.tmdbId === 744933), 'foreign alternate titles must not be searchable');
assert.ok(buildSearchResults('Christmas in Solvang').movies.some((movie) => movie.tmdbId === 744933), 'English US alternate titles must remain searchable');
assert.equal(merryMysteryChristmas.year, 2023, 'search must retain the movie release year');

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
