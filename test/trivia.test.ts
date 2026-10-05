import assert from 'node:assert/strict';
import type { Actor, Movie } from '../src/types';
import { getAllActors } from '../src/data/actors';
import { MOVIES } from '../src/data/movies';
import { getMovieNetworkPremiereDateKey, getMoviePremiereDateKey } from '../src/utils/catalogue-lifecycle';
import { formatCharacterName, generateTriviaFacts, getTriviaFacts, getTriviaReleaseDateKey, normalizeCharacterFirstName, normalizeCharacterName, selectTriviaFact, TRIVIA_GENERATORS } from '../src/utils/trivia';

const fixtureMovie = (id: number, title: string, releaseDate: string, cast: Movie['cast'] = []): Movie => ({
  id: `fixture-${id}`, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, year: Number(releaseDate.slice(0, 4)), brandId: 'hallmark', releaseDate,
  runtimeMinutes: 90, synopsis: '', posterUrl: '', cast, tmdbId: id, status: 'collection', networkPremiereDate: '2025-12-25',
});

const facts = getTriviaFacts(new Date('2026-10-04T12:00:00Z'));
assert.equal(TRIVIA_GENERATORS.length, 75, 'the engine should expose the current independent generator count');
assert.ok(facts.length >= 200, 'the real catalogue should produce a large eligible fact pool');
assert.equal(facts.find((fact) => fact.id === 'actors:same-year:92612'), undefined, 'Roark Critchlow does not qualify for a same-year fact with only two 2022 movies');
assert.ok(!facts.some((fact) => /\bappears in 2 XmasDB movies in \d{4}\b/.test(fact.text)), 'the real pool contains no actor/year facts with only two movies');
assert.ok(!facts.some((fact) => /\b2 XmasDB movies\b/.test(fact.text)), 'the real pool contains no two-movie trivia bypassing a minimum threshold');
assert.equal(new Set(facts.map((fact) => fact.id)).size, facts.length, 'fact IDs are stable and unique');
assert.ok(facts.every((fact) => fact.text.trim() && fact.id.trim()), 'facts cannot be empty');
assert.ok(facts.every((fact) => !/appears in 1 Christmas movie|appeared together in 1 /.test(fact.text)), 'single-occurrence trivia is filtered out');
assert.ok(facts.every((fact) => !fact.href || /^\/(?:actor|movie|year|birthdays|calendar|hallmark|lifetime|gaf|uptv|movies)/.test(fact.href)), 'fact links use existing local routes');
const actorIds = new Set(getAllActors().map((actor) => actor.tmdbPersonId));
const movieIds = new Set(MOVIES.map((movie) => movie.tmdbId));
const internalTerms = /\b(?:canonical|metadata|manifest|entity|date key|resolved date|stored status|structured local data|genuine release date|local portrait|local image|local profiles|locally identified|catalogued locally|TMDB actor)\b/i;
const invalidTriviaPath = (path: string): boolean => !/^\/(?:actor|movie|year|birthdays|calendar|hallmark|lifetime|gaf|uptv|movies)(?:\/|$)/.test(path);
assert.ok(facts.every((fact) => !internalTerms.test(fact.text)), 'visitor-facing facts do not expose implementation terminology');
assert.ok(facts.every((fact) => !/\b(?:undefined|null|NaN)\b|\b0\s+XmasDB\b|\b1\s+(?:movies|actors|stars|directors|writers)\b/i.test(fact.text)), 'facts do not leak invalid values or awkward zero/singular counts');
assert.ok(facts.every((fact) => !(fact.segments || []).some((segment) => segment.href && invalidTriviaPath(segment.href))), 'entity links use existing local routes');
assert.ok(facts.every((fact) => (fact.relatedActorIds || []).every((id) => actorIds.has(id)) && (fact.relatedMovieIds || []).every((id) => movieIds.has(id))), 'related entity IDs resolve to catalogue records');
assert.ok(facts.filter((fact) => fact.relatedActorIds?.length && fact.category !== 'birthdays').every((fact) => fact.segments?.some((segment) => Boolean(segment.href))), 'named actor facts link to actor pages');
assert.ok(facts.filter((fact) => fact.relatedMovieIds?.length && ['movies', 'titles'].includes(fact.category)).every((fact) => fact.segments?.some((segment) => Boolean(segment.href))), 'named movie facts link to movie pages');
const resolvedReleaseDate = (movie: Movie): string | null => getTriviaReleaseDateKey(movie);
const decemberCount = MOVIES.filter((movie) => resolvedReleaseDate(movie)?.slice(5, 7) === '12').length;
assert.ok(facts.find((fact) => fact.id === 'movies:december')?.text.includes(`${decemberCount} XmasDB movies`), 'historical aggregate counts are reproducible from past release records');
assert.ok(facts.find((fact) => fact.id === 'calendar:this-month')?.text.includes('73 XmasDB movies'), 'catalogue-wide October distribution includes future October records');
assert.ok(facts.some((fact) => fact.category === 'co-stars'));
assert.ok(facts.some((fact) => fact.category === 'characters'));

const slot = new Date('2026-10-04T12:02:00Z');
assert.equal(selectTriviaFact(slot)?.id, selectTriviaFact(new Date(slot.getTime() + 60_000))?.id, 'the same five-minute slot is deterministic');
const rotated = new Set<string>();
for (let index = 0; index < 20; index += 1) rotated.add(selectTriviaFact(new Date(slot.getTime() + (index + 1) * 5 * 60_000))?.id || '');
assert.ok(rotated.size > 1, 'time slots rotate through more than one fact');
const rotationContext = { actor: getAllActors().find((actor) => actor.tmdbPersonId === 2119068) };
const rotationFacts = Array.from({ length: 100 }, (_, index) => selectTriviaFact(new Date(new Date('2026-10-04T12:00:00Z').getTime() + index * 5 * 60_000), rotationContext)?.id || '');
assert.equal(new Set(rotationFacts.slice(0, 24)).size, 24, 'the rotation shows a unique fact for each of the first 24 slots');
assert.equal(new Set(rotationFacts).size, 100, 'the rotation shows a unique fact for each of the first 100 slots');
assert.ok(rotationFacts.every((id, index) => index === 0 || id !== rotationFacts[index - 1]), 'the rotation never repeats a consecutive fact');
assert.equal(selectTriviaFact(new Date('2026-10-04T12:00:00Z'), rotationContext)?.id, selectTriviaFact(new Date('2026-10-04T12:00:00Z'), rotationContext)?.id, 'the rotation remains deterministic within a slot');

assert.equal(normalizeCharacterName('  Lisa   Miller  '), 'Lisa Miller');
assert.equal(normalizeCharacterName('Uncredited'), null);
assert.equal(normalizeCharacterFirstName('Lisa Miller'), 'Lisa');
assert.equal(normalizeCharacterFirstName('Background Person'), null);
assert.equal(formatCharacterName('nathan'), 'Nathan');
assert.equal(formatCharacterName("o'brien"), "O'Brien");
assert.equal(formatCharacterName('mary-jane'), 'Mary-Jane');
assert.equal(formatCharacterName('mckenna'), 'McKenna');
assert.equal(formatCharacterName('j.r.'), 'J.R.');

const birthdayActor: Actor = { id: 'fixture-actor', slug: 'fixture-actor', name: 'Fixture Star', tmdbPersonId: 999001, birthday: '1980-10-04' };
const secondActor: Actor = { id: 'second-actor', slug: 'second-star', name: 'Second Star', tmdbPersonId: 999002 };
const pairCast = [
  { actorId: '1', name: 'Fixture Star', character: 'Lisa Miller', slug: 'fixture-actor', tmdbPersonId: 999001 },
  { actorId: '2', name: 'Second Star', character: 'Alex', slug: 'second-star', tmdbPersonId: 999002 },
  { actorId: '2b', name: 'Second Star', character: 'Alex', slug: 'second-star', tmdbPersonId: 999002 },
];
const fixtureMovies = [fixtureMovie(900001, 'The Christmas Love Story', '2020-12-01', pairCast), fixtureMovie(900002, 'A Christmas Love Reunion', '2025-12-02', pairCast), fixtureMovie(900003, 'A Christmas Love Return', '2026-12-03', pairCast)];
assert.equal(getMoviePremiereDateKey(fixtureMovies[0]), '2020-12-01');
assert.equal(getMovieNetworkPremiereDateKey(fixtureMovies[0]), '2025-12-25');
const fixtureFacts = generateTriviaFacts(fixtureMovies, [birthdayActor], new Date('2026-10-04T12:00:00Z'));
assert.ok(fixtureFacts.some((fact) => fact.id === 'birthdays:today'), 'date-sensitive birthday facts use the supplied date');
assert.ok(fixtureFacts.some((fact) => fact.id.startsWith('co-stars:pair:')), 'co-star facts deduplicate repeated cast IDs');
assert.ok(fixtureFacts.some((fact) => fact.id === 'movies:oldest' && fact.text.includes('2020')), 'movie facts use the actual release date, not the network premiere override');
assert.notEqual(generateTriviaFacts([...fixtureMovies, fixtureMovie(900004, 'New Fixture Movie', '2026-01-01')], [birthdayActor], new Date('2026-10-04T12:00:00Z')).find((fact) => fact.id === 'movies:catalogue-size')?.text, fixtureFacts.find((fact) => fact.id === 'movies:catalogue-size')?.text, 'adding a fixture movie changes generated data without adding trivia copy');
const linkedFacts = generateTriviaFacts(fixtureMovies, [birthdayActor, secondActor], new Date('2026-10-04T12:00:00Z'));
const coStarFact = linkedFacts.find((fact) => fact.id.startsWith('co-stars:pair:'));
assert.equal(coStarFact?.segments?.filter((segment) => segment.href).length, 2, 'co-star facts link both identifiable actors');
assert.deepEqual(coStarFact?.segments?.filter((segment) => segment.href).map((segment) => segment.href), ['/actor/999001/fixture-actor/', '/actor/999002/second-star/'], 'co-star links use canonical actor routes');
const movieFact = linkedFacts.find((fact) => fact.id === 'movies:oldest');
assert.equal(movieFact?.segments?.find((segment) => segment.href)?.href, '/movie/900001/the-christmas-love-story/', 'movie facts link the referenced movie title');
assert.equal(linkedFacts.find((fact) => fact.id === 'movies:catalogue-size')?.segments, undefined, 'facts without an applicable entity remain unlinked');
const triviaNow = new Date('2026-10-04T12:00:00Z');
const sameYearCast = [{ actorId: 'same-year-actor', name: 'Same Year Star', character: 'Lead', slug: 'fixture-actor', tmdbPersonId: 999001 }];
const sameYearTwo = [fixtureMovie(905001, 'Same Year One', '2024-01-01', sameYearCast), fixtureMovie(905002, 'Same Year Two', '2024-02-01', sameYearCast)];
const sameYearThree = [...sameYearTwo, fixtureMovie(905003, 'Same Year Three', '2024-03-01', sameYearCast)];
const sameYearActor = [birthdayActor];
assert.ok(!generateTriviaFacts(sameYearTwo, sameYearActor, triviaNow).some((fact) => fact.id === 'actors:same-year:999001'), 'two movies in one year do not produce a same-year actor fact');
assert.ok(generateTriviaFacts(sameYearThree, sameYearActor, triviaNow).some((fact) => fact.id === 'actors:same-year:999001' && fact.text.includes('3 XmasDB movies')), 'three movies in one year produce a same-year actor fact');
assert.ok(generateTriviaFacts([...sameYearTwo, sameYearTwo[0]], sameYearActor, triviaNow).every((fact) => !fact.id.startsWith('actors:same-year:')), 'duplicate movie records cannot inflate same-year counts');

const pastComingSoon = { ...fixtureMovie(901001, 'Past Coming Soon', '2026-10-01'), premiereDate: undefined, networkPremiereDate: '2026-12-01', status: 'coming-soon' };
const futureComingSoon = { ...fixtureMovie(901002, 'Future Coming Soon', '2026-10-05'), premiereDate: undefined, status: 'coming-soon' };
const futureReleased = { ...fixtureMovie(901003, 'Future Released Status', '2026-10-06'), premiereDate: undefined, status: 'released' };
assert.equal(getTriviaReleaseDateKey(pastComingSoon), '2026-10-01', 'trivia release dates fall back to releaseDate despite Coming Soon status');
const premiereDateMovie = { ...pastComingSoon, premiereDate: '2026-09-30', networkPremiereDate: '2026-12-01' };
const networkDateMovie = { ...pastComingSoon, premiereDate: undefined, releaseDate: '2026-10-01', networkPremiereDate: '2026-06-01' };
assert.equal(getTriviaReleaseDateKey(premiereDateMovie), '2026-09-30', 'premiereDate takes precedence over releaseDate');
assert.equal(getTriviaReleaseDateKey(networkDateMovie), '2026-10-01', 'networkPremiereDate never overrides genuine release date');
assert.equal(getTriviaReleaseDateKey({ ...pastComingSoon, premiereDate: undefined, releaseDate: '' }), null, 'missing dates do not resolve for trivia');
const lifecycleFixtureFacts = generateTriviaFacts([pastComingSoon, ...fixtureMovies, futureComingSoon, futureReleased], [], triviaNow);
assert.ok(lifecycleFixtureFacts.some((fact) => fact.id === 'movies:newest-released' && fact.relatedMovieIds?.includes(901001)), 'a past-dated Coming Soon movie wins newest released trivia');
assert.ok(lifecycleFixtureFacts.find((fact) => fact.id === 'movies:newest-released')?.text.includes('most recently released'), 'newest wording identifies the measured date');
const upcomingFixtureFacts = generateTriviaFacts([futureComingSoon, futureReleased, ...[901004, 901005, 901006].map((id) => ({ ...fixtureMovie(id, `Future ${id}`, '2026-10-07'), premiereDate: undefined }))], [], triviaNow);
assert.ok(upcomingFixtureFacts.some((fact) => fact.id === 'movies:upcoming' && fact.text.includes('5 XmasDB movies')), 'future genuine dates are upcoming regardless of status');
assert.ok(upcomingFixtureFacts.find((fact) => fact.id === 'movies:upcoming')?.text.includes('genuine release dates after today'), 'upcoming wording identifies the measured date');
const decemberFacts = generateTriviaFacts(fixtureMovies, [], new Date('2026-12-10T12:00:00Z'));
assert.equal(decemberFacts.find((fact) => fact.id === 'calendar:this-month')?.text, 'Across all years, 3 XmasDB movies have a December release date.', 'historical month wording states its all-date scope');
const octoberCatalogue = [
  fixtureMovie(901100, 'Past October Fixture', '2020-10-01'),
  { ...fixtureMovie(901101, 'Future October Fixture One', '2026-10-10'), status: 'coming-soon' },
  { ...fixtureMovie(901102, 'Future October Fixture Two', '2026-10-20'), status: 'released' },
  { ...fixtureMovie(901103, 'Network October Only Fixture', '2026-11-01'), networkPremiereDate: '2026-10-02', status: 'coming-soon' },
];
assert.equal(generateTriviaFacts(octoberCatalogue, [], triviaNow).find((fact) => fact.id === 'calendar:this-month')?.text, 'Across all years, 3 XmasDB movies have an October release date.', 'October distribution includes future dates and excludes network premieres');
const decemberCatalogue = Array.from({ length: 10 }, (_, index) => fixtureMovie(902000 + index, `December Fixture ${index}`, `2026-12-${String(index + 1).padStart(2, '0')}`));
assert.equal(generateTriviaFacts(decemberCatalogue, [], triviaNow).find((fact) => fact.id === 'movies:december')?.text, 'Across all years, 10 XmasDB movies have a December release date.', 'December distribution includes future dates');
const undatedFixtureFacts = generateTriviaFacts([1, 2, 3, 4, 5].map((id) => ({ ...fixtureMovie(901000 + id, `Undated ${id}`, '2026-01-01'), releaseDate: '', premiereDate: undefined, status: 'coming-soon' })), [], triviaNow);
assert.ok(!undatedFixtureFacts.some((fact) => fact.id === 'movies:newest-released' || fact.id === 'movies:upcoming'), 'undated movies do not produce released or upcoming facts');

const smallRuntimeYear = Array.from({ length: 7 }, (_, index) => ({
  ...fixtureMovie(904000 + index, `Small Runtime ${index}`, `2009-12-${String(index + 1).padStart(2, '0')}`),
  runtimeMinutes: 80 + index,
}));
const largeRuntimeYear = Array.from({ length: 15 }, (_, index) => ({
  ...fixtureMovie(904100 + index, `Large Runtime ${index}`, `2010-12-${String(index + 1).padStart(2, '0')}`),
  runtimeMinutes: 80 + index,
}));
const smallRuntimeFacts = generateTriviaFacts(smallRuntimeYear, [], triviaNow);
assert.ok(!smallRuntimeFacts.some((fact) => fact.id === 'runtime:average-year:2009'), 'seven-movie year averages are rejected');
const largeRuntimeFacts = generateTriviaFacts(largeRuntimeYear, [], triviaNow);
const largeYearAverage = largeRuntimeFacts.find((fact) => fact.id === 'runtime:average-year:2010');
assert.equal(largeYearAverage?.text, 'Christmas movies from 2010 average 87 minutes in XmasDB.', 'large year averages are rounded to whole minutes');
assert.deepEqual(largeYearAverage?.segments?.filter((segment) => segment.href).map((segment) => segment.text), ['2010'], 'year averages link only the year');
assert.ok(largeRuntimeFacts.some((fact) => fact.id === 'runtime:average-network:hallmark'), 'network averages use the same meaningful sample threshold');
assert.deepEqual(largeRuntimeFacts.find((fact) => fact.id === 'runtime:average-network:hallmark')?.segments?.filter((segment) => segment.href).map((segment) => segment.text), ['Hallmark'], 'network averages link only the network name');
assert.ok([...getTriviaFacts(triviaNow), ...largeRuntimeFacts].every((fact) => !/valid runtimes|usable runtimes|sample size|records with runtime data|qualifying records|valid values|based on \d+/.test(fact.text)), 'runtime trivia does not expose analysis language');
assert.ok(fixtureFacts.some((fact) => fact.id === 'runtime:longest'), 'catalogue runtime records remain eligible');
assert.ok(fixtureFacts.some((fact) => fact.id === 'titles:longest'), 'catalogue title records remain eligible');

const characterFacts = generateTriviaFacts([
  fixtureMovie(903001, 'Character One', '2020-12-01', [{ actorId: '1', name: 'Actor', character: 'nAtHaN', slug: 'actor', tmdbPersonId: 903001 }]),
  fixtureMovie(903002, 'Character Two', '2021-12-01', [{ actorId: '2', name: 'Actor', character: 'Nathan', slug: 'actor', tmdbPersonId: 903002 }]),
  fixtureMovie(903003, 'Character Three', '2022-12-01', [{ actorId: '3', name: 'Actor', character: 'NATHAN', slug: 'actor', tmdbPersonId: 903003 }]),
], [], triviaNow);
assert.ok(characterFacts.some((fact) => fact.id === 'characters:recurring:nathan' && fact.text === 'The character name Nathan appears in 3 XmasDB movies.'), 'character trivia uses a human-readable display name and polished wording');
assert.ok(characterFacts.every((fact) => !fact.text.includes('character name “nathan”') && !fact.text.includes('character name nathan”')), 'character trivia does not expose raw lowercase keys');

const actorContextFact = selectTriviaFact(new Date('2026-10-04T12:00:00Z'), { actor: getAllActors()[0] });
assert.ok(actorContextFact, 'actor pages fall back to a global fact when no contextual fact qualifies');

console.log(`Trivia engine generated ${facts.length} real-catalogue facts across ${new Set(facts.map((fact) => fact.category)).size} categories.`);
