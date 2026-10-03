import assert from 'node:assert/strict';
import type { ActorFilmographyItem } from '../src/api/types';
import { getFilmographyMilestones } from '../src/utils/filmography-milestones';

const movie = (tmdbId: number, title: string, year: number, releaseDate: string): ActorFilmographyItem => ({
  id: `movie-${tmdbId}`,
  slug: title.toLowerCase().replaceAll(' ', '-'),
  title,
  year,
  brandId: 'hallmark',
  tmdbId,
  posterUrl: '',
  releaseDate,
});

const dated = getFilmographyMilestones([
  movie(2, 'Later Same Year', 2020, '2020-12-20'),
  movie(1, 'Earlier Same Year', 2020, '2020-01-20'),
  movie(3, 'Latest Movie', 2022, '2022-11-01'),
]);
assert.equal(dated?.first.movie.title, 'Earlier Same Year');
assert.equal(dated?.latest.movie.title, 'Latest Movie');

const single = getFilmographyMilestones([movie(4, 'One Movie', 2021, '2021-06-01')]);
assert.equal(single?.first.movie.title, 'One Movie');
assert.equal(single?.latest.movie.title, 'One Movie');

const missingDate = getFilmographyMilestones([
  movie(5, 'Older Fallback', 2012, ''),
  movie(6, 'Newer Fallback', 2026, 'not-a-date'),
]);
assert.equal(missingDate?.first.movie.title, 'Older Fallback');
assert.equal(missingDate?.latest.movie.title, 'Newer Fallback');
assert.equal(missingDate?.first.dateKey, null);
assert.equal(missingDate?.latest.dateKey, null);
assert.equal(getFilmographyMilestones([]), null);

console.log('Filmography milestone selection tests passed.');
