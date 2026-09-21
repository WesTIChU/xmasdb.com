import assert from 'node:assert/strict';
import { buildActorDetail } from '../src/server/catalogue-api';

const paulCampbell = buildActorDetail('62909', undefined, new Date('2026-01-01'));
assert.ok(paulCampbell, 'Paul Campbell actor fixture should exist');

const returnToSantaIndex = paulCampbell!.filmography.findIndex((movie) => movie.title === 'Return to Santa');
assert.equal(returnToSantaIndex, 0, 'upcoming Return to Santa should lead the filmography');
assert.ok(paulCampbell!.filmography[1].releaseDate > paulCampbell!.filmography[2].releaseDate, 'released movies should follow newest-to-oldest order');

console.log('Actor filmography lifecycle ordering passed.');
