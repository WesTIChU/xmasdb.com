import assert from 'node:assert/strict';
import type { Actor, Movie } from '../src/types';
import { getFrequentCoStars } from '../src/utils/co-stars';

const actor = (tmdbPersonId: number, name: string, slug = name.toLowerCase().replaceAll(' ', '-')): Actor => ({
  id: String(tmdbPersonId),
  slug,
  name,
  tmdbPersonId,
});

const current = actor(1, 'Current Actor');
const alpha = actor(2, 'Alpha Star');
const beta = actor(3, 'Beta Star');
const oneMovie = actor(4, 'One Movie Star');
const crewOnly = actor(5, 'Crew Only Star');

const movie = (id: number, cast: Array<{ actor: Actor; character?: string }>, crew: Actor[] = []): Movie => ({
  id: `movie-${id}`,
  slug: `movie-${id}`,
  title: `Movie ${id}`,
  year: 2020,
  brandId: 'hallmark',
  releaseDate: '2020-12-01',
  synopsis: '',
  posterUrl: '',
  tmdbId: id,
  cast: cast.map(({ actor: castActor, character = 'Character' }) => ({
    actorId: castActor.id,
    name: castActor.name,
    character,
    slug: castActor.slug,
    tmdbPersonId: castActor.tmdbPersonId,
  })),
  crew: crew.map((crewActor) => ({ id: crewActor.tmdbPersonId, name: crewActor.name, job: 'Writer' })),
});

const movies = [
  movie(1, [{ actor: current }, { actor: alpha }, { actor: alpha }, { actor: beta }], [crewOnly]),
  movie(2, [{ actor: current }, { actor: alpha }, { actor: beta }]),
  movie(3, [{ actor: current }, { actor: alpha }, { actor: beta }]),
  movie(4, [{ actor: current }, { actor: oneMovie }]),
];

const coStars = getFrequentCoStars(current, movies, [current, alpha, beta, oneMovie, crewOnly]);
assert.deepEqual(coStars.map(({ actor: coStar, sharedMovieCount }) => [coStar.name, sharedMovieCount]), [
  ['Alpha Star', 3],
  ['Beta Star', 3],
]);
assert.ok(!coStars.some(({ actor: coStar }) => coStar.tmdbPersonId === current.tmdbPersonId), 'current actor is excluded');
assert.ok(!coStars.some(({ actor: coStar }) => coStar.tmdbPersonId === crewOnly.tmdbPersonId), 'crew-only relationships are excluded');
assert.ok(!coStars.some(({ actor: coStar }) => coStar.tmdbPersonId === oneMovie.tmdbPersonId), 'one-movie co-stars do not meet the threshold');

const duplicateMovieIds = getFrequentCoStars(current, [movies[0], { ...movies[0], id: 'duplicate-record', tmdbId: 1 }], [current, alpha, beta], 1);
assert.equal(duplicateMovieIds.find(({ actor: coStar }) => coStar.tmdbPersonId === alpha.tmdbPersonId)?.sharedMovieCount, 1, 'the same TMDB movie is counted once');

assert.deepEqual(getFrequentCoStars(current, [movie(9, [{ actor: current }, { actor: oneMovie }])], [current, oneMovie]), [], 'section data is empty when nobody meets the threshold');

console.log('Frequent co-star counting, deduplication, sorting, acting-only filtering, and threshold tests passed.');
