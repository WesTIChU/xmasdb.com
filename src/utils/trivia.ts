import type { Actor, CastMember, Movie } from '../types';
import type { TriviaCategory, TriviaFact, TriviaTextSegment } from '../api/types';
import { getAllActors, getTmdbPersonIdForSlug } from '../data/actors';
import { MOVIES } from '../data/movies';
import { getBrandById } from '../data/brands';
import { getCreativeCrew } from './creative-crew';
import { parseBirthday } from './birthdays';
import { getActorPath, getMoviePath, getMoviesPath, getNetworkPath, getYearPath } from './urls';
import { getMoviePoster } from './posters';

export interface TriviaContext {
  movie?: Movie;
  actor?: Actor;
}

interface TriviaSource {
  movies: Movie[];
  actors: Actor[];
  now: Date;
}

type TriviaGenerator = (source: TriviaSource) => TriviaFact[];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NETWORK_IDS = ['hallmark', 'lifetime', 'gaf', 'uptv'];
const MIN_RUNTIME_AVERAGE_SAMPLE = 15;
const MIN_GROUP_PERCENTAGE_SAMPLE = 15;
const MIN_SAME_YEAR_MOVIES = 3;
const STOP_WORDS = new Set(['a', 'an', 'and', 'at', 'for', 'from', 'in', 'is', 'it', 'my', 'of', 'on', 'or', 'the', 'to', 'with']);
const GARBAGE_CHARACTERS = new Set(['', 'n/a', 'na', 'none', 'unknown', 'uncredited', 'self', 'himself', 'herself', 'themselves', 'various', 'voice', 'young', 'old', 'mayor', 'barista', 'caroler', 'manager', 'doctor', 'nurse', 'teacher', 'shopkeeper', 'mr', 'mrs', 'ms', 'dr', 'sir', 'lady']);

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function entitySegments(text: string, links: Array<{ text: string; href?: string }>): TriviaTextSegment[] | undefined {
  const validLinks = links.filter((link) => link.href && link.text);
  if (!validLinks.length) return undefined;
  const segments: TriviaTextSegment[] = [];
  let cursor = 0;
  validLinks.forEach((link) => {
    const start = text.indexOf(link.text, cursor);
    if (start < 0) return;
    if (start > cursor) segments.push({ text: text.slice(cursor, start) });
    segments.push({ text: link.text, href: link.href });
    cursor = start + link.text.length;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length ? segments : undefined;
}

function linkedFact(id: string, category: TriviaCategory, text: string, links: Array<{ text: string; href?: string }>, options: Omit<TriviaFact, 'id' | 'category' | 'text' | 'segments'> = {}): TriviaFact {
  const segments = entitySegments(text, links);
  return fact(id, category, text, { ...options, ...(segments ? { segments } : {}) });
}

function fact(id: string, category: TriviaCategory, text: string, options: Omit<TriviaFact, 'id' | 'category' | 'text'> = {}): TriviaFact {
  return { id, category, text, ...options };
}

/**
 * Trivia deliberately uses temporal release reality rather than lifecycle
 * status. A stale Coming Soon status must not hide a date that has passed.
 * Network premiere dates are a separate calendar concept and are excluded.
 */
export function getTriviaReleaseDateKey(movie: Pick<Movie, 'premiereDate' | 'releaseDate'>): string | null {
  const parseDate = (value: string | undefined): string | null => {
    if (!value || typeof value !== 'string') return null;
    const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (dateOnly && !Number.isNaN(Date.parse(`${dateOnly}T00:00:00Z`))) return dateOnly;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return null;
    const date = new Date(parsed);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  };
  return parseDate(movie.premiereDate) || parseDate(movie.releaseDate);
}

function movieDate(movie: Movie): string | null {
  return getTriviaReleaseDateKey(movie);
}

function dateValue(movie: Movie): number | null {
  const value = movieDate(movie);
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

function releasedDate(movie: Movie, now: Date): string | null {
  const date = movieDate(movie);
  return date && dateValue(movie) !== null && dateValue(movie)! <= now.getTime() ? date : null;
}

function personId(member: CastMember): number {
  return member.tmdbPersonId || getTmdbPersonIdForSlug(member.slug);
}

function uniqueCast(movie: Movie): number[] {
  return [...new Set(movie.cast.map(personId).filter((id) => id > 0))];
}

function actorName(id: number, source: TriviaSource, fallback?: string): string {
  return source.actors.find((actor) => actor.tmdbPersonId === id)?.name || fallback || `TMDB actor ${id}`;
}

function actorLink(id: number, source: TriviaSource): string | undefined {
  const actor = source.actors.find((candidate) => candidate.tmdbPersonId === id);
  return actor ? getActorPath(actor.tmdbPersonId, actor.slug) : undefined;
}

function countBy<T>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return counts;
}

function sortedCounts<T>(counts: Map<T, number>): Array<[T, number]> {
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])));
}

function actorMovies(source: TriviaSource): Map<number, Movie[]> {
  const result = new Map<number, Movie[]>();
  source.movies.forEach((movie) => uniqueCast(movie).forEach((id) => {
    const movies = result.get(id) || [];
    if (!movies.some((existing) => existing.tmdbId === movie.tmdbId)) result.set(id, [...movies, movie]);
  }));
  return result;
}

export function normalizeCharacterName(value: string | undefined): string | null {
  const clean = value?.trim().replace(/\s+/g, ' ') || '';
  const lower = clean.toLowerCase().replace(/[.!?,]/g, '');
  if (GARBAGE_CHARACTERS.has(lower) || clean.length < 2 || clean.length > 80) return null;
  if (/^(additional|background|featured|guest|man|woman|boy|girl|person|partygoer|employee|waiter|waitress)\b/i.test(clean)) return null;
  if (!/[a-z]/i.test(clean)) return null;
  return clean;
}

export function normalizeCharacterFirstName(value: string): string | null {
  const clean = normalizeCharacterName(value);
  if (!clean) return null;
  const first = clean.split(/\s+/)[0].replace(/^[^a-z]+|[^a-z'-]+$/gi, '');
  if (first.length < 2 || first.length > 24 || !/^[a-z][a-z'-]*$/i.test(first) || GARBAGE_CHARACTERS.has(first.toLowerCase())) return null;
  return first;
}

function characterNameKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Formats a validated stored character name for reader-facing trivia. */
export function formatCharacterName(value: string): string {
  const clean = normalizeCharacterName(value) || value.trim().replace(/\s+/g, ' ');
  return clean.split(/([\s.'-]+)/).map((part) => {
    if (/^[\s.'-]+$/.test(part)) return part;
    const lower = part.toLocaleLowerCase();
    if (/^mc[a-z]/.test(lower)) return `Mc${lower[2].toLocaleUpperCase()}${lower.slice(3)}`;
    return lower ? `${lower[0].toLocaleUpperCase()}${lower.slice(1)}` : lower;
  }).join('');
}

function characterNameCounts(values: string[]): Map<string, { display: string; count: number }> {
  const counts = new Map<string, { display: string; count: number }>();
  values.forEach((value) => {
    const key = characterNameKey(value);
    const current = counts.get(key);
    counts.set(key, { display: current?.display || formatCharacterName(value), count: (current?.count || 0) + 1 });
  });
  return counts;
}

function birthdayEntries(source: TriviaSource): Array<{ actor: Actor; month: number; day: number }> {
  return source.actors.flatMap((actor) => {
    const birthday = parseBirthday(actor.birthday);
    return birthday ? [{ actor, month: birthday.month, day: birthday.day }] : [];
  });
}

function yearCounts(movies: Movie[], now?: Date): Map<number, number> {
  return countBy(movies.flatMap((movie) => { const date = now ? releasedDate(movie, now) : movieDate(movie); return date ? [Number(date.slice(0, 4))] : []; }));
}

function networkLabel(id: string): string {
  return getBrandById(id)?.shortName || id.toUpperCase();
}

function titleWords(movies: Movie[]): Map<string, number> {
  const words = movies.flatMap((movie) => movie.title.toLowerCase().match(/[a-z][a-z']+/g) || [])
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
  return countBy(words);
}

function validRuntime(movie: Movie): number | null {
  const runtime = movie.runtimeMinutes;
  return typeof runtime === 'number' && Number.isFinite(runtime) && runtime >= 30 && runtime <= 300 ? runtime : null;
}

function runtimeEntries(movies: Movie[]): Array<{ movie: Movie; runtime: number }> {
  return movies.flatMap((movie) => { const runtime = validRuntime(movie); return runtime === null ? [] : [{ movie, runtime }]; });
}

function movieYear(movie: Movie): number | null {
  const date = movieDate(movie);
  const year = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

function percent(value: number, total: number): string {
  return `${Math.round((value / total) * 100)}%`;
}

function roundedAverage(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function titleLengthFact(movie: Movie, id: string, wording: string, priority: number): TriviaFact {
  return linkedFact(id, 'titles', wording, [{ text: movie.title, href: getMoviePath(movie.tmdbId, movie.slug) }], { href: getMoviePath(movie.tmdbId, movie.slug), relatedMovieIds: [movie.tmdbId], priority });
}

function groupedTitleExtremes(source: TriviaSource, group: 'network' | 'year', longest: boolean): TriviaFact[] {
  const groups = new Map<string | number, Movie[]>();
  source.movies.forEach((movie) => { const key = group === 'network' ? movie.brandId : movieYear(movie); if (key !== null && key !== undefined) groups.set(key, [...(groups.get(key) || []), movie]); });
  return [...groups.entries()].filter(([, movies]) => movies.length >= 2).map(([key, movies]) => {
    const movie = [...movies].sort((a, b) => (longest ? b.title.length - a.title.length : a.title.length - b.title.length) || a.title.localeCompare(b.title))[0];
    const label = group === 'network' ? networkLabel(String(key)) : String(key);
    const text = `${movie.title} is the ${longest ? 'longest' : 'shortest'} title in XmasDB's ${label} collection.`;
    const groupHref = group === 'year' ? getYearPath(Number(key)) : getNetworkPath(String(key));
    return linkedFact(`titles:${longest ? 'longest' : 'shortest'}-${group}:${key}`, 'titles', text, [{ text: movie.title, href: getMoviePath(movie.tmdbId, movie.slug) }, { text: label, href: groupHref }], { href: getMoviePath(movie.tmdbId, movie.slug), relatedMovieIds: [movie.tmdbId], priority: 2 });
  });
}

function groupedRuntimeExtremes(source: TriviaSource, group: 'network' | 'year', longest: boolean): TriviaFact[] {
  const groups = new Map<string | number, Array<{ movie: Movie; runtime: number }>>();
  runtimeEntries(source.movies).forEach((entry) => { const key = group === 'network' ? entry.movie.brandId : movieYear(entry.movie); if (key !== null && key !== undefined) groups.set(key, [...(groups.get(key) || []), entry]); });
  return [...groups.entries()].filter(([, entries]) => entries.length >= 2).map(([key, entries]) => {
    const entry = [...entries].sort((a, b) => (longest ? b.runtime - a.runtime : a.runtime - b.runtime) || a.movie.title.localeCompare(b.movie.title))[0];
    const label = group === 'network' ? networkLabel(String(key)) : String(key);
    const text = `${entry.movie.title} has the ${longest ? 'longest' : 'shortest'} listed runtime in XmasDB's ${label} collection, at ${entry.runtime} minutes.`;
    return linkedFact(`runtime:${longest ? 'longest' : 'shortest'}-${group}:${key}`, 'movies', text, [{ text: entry.movie.title, href: getMoviePath(entry.movie.tmdbId, entry.movie.slug) }, { text: label, href: group === 'network' ? getNetworkPath(String(key)) : undefined }], { href: getMoviePath(entry.movie.tmdbId, entry.movie.slug), relatedMovieIds: [entry.movie.tmdbId], priority: 2 });
  });
}

function topActorFact(source: TriviaSource, minimum: number, id: string, wording: (name: string, count: number) => string): TriviaFact[] {
  const counts = actorMovies(source);
  return [...counts.entries()].sort((left, right) => right[1].length - left[1].length || left[0] - right[0])
    .filter(([, movies]) => movies.length >= minimum)
    .slice(0, 10)
    .map(([actorId, movies], index) => linkedFact(`${id}:${actorId}`, 'actors', wording(actorName(actorId, source), movies.length), [{ text: actorName(actorId, source), href: actorLink(actorId, source) }], {
      emphasis: actorName(actorId, source), href: actorLink(actorId, source), relatedActorIds: [actorId], priority: 10 - index,
    }));
}

const generators: TriviaGenerator[] = [
  (s) => [fact('movies:catalogue-size', 'movies', `XmasDB's Christmas collection contains ${s.movies.length.toLocaleString()} movies.`, { priority: 3 })],
  (s) => [fact('actors:catalogue-size', 'actors', `${s.actors.length.toLocaleString()} Christmas stars have profiles in XmasDB.`, { priority: 3 })],
  (s) => NETWORK_IDS.map((id) => {
    const count = s.movies.filter((movie) => movie.brandId === id).length;
    const label = networkLabel(id);
    return linkedFact(`networks:count:${id}`, 'networks', `${label} has ${count.toLocaleString()} movies in the XmasDB collection.`, [{ text: label, href: getNetworkPath(id) }], { priority: count >= 50 ? 5 : 1 });
  }).filter((entry) => Number(entry.text.match(/[\d,]+/)?.[0]?.replace(',', '') || 0) >= 20),
  (s) => { const [id, count] = sortedCounts(countBy(s.movies.map((movie) => movie.brandId)))[0] || []; const label = id ? networkLabel(id) : ''; return id ? [linkedFact('networks:largest', 'networks', `${label} has the largest XmasDB catalogue, with ${count} movies.`, [{ text: label, href: getNetworkPath(id) }], { priority: 7 })] : []; },
  (s) => { const [year, count] = sortedCounts(yearCounts(s.movies))[0] || []; return year ? [linkedFact('movies:busiest-year', 'movies', `Across all years, ${count} XmasDB movies were released in ${year}, the busiest release year.`, [{ text: String(year), href: getYearPath(year) }], { priority: 6 })] : []; },
  (s) => { const dated = s.movies.map((movie) => ({ movie, time: dateValue(movie) })).filter((entry): entry is { movie: Movie; time: number } => entry.time !== null).sort((a, b) => a.time - b.time); const entry = dated[0]; if (!entry) return []; const text = `The oldest movie by release date is ${entry.movie.title} (${new Date(entry.time).getUTCFullYear()}).`; return [linkedFact('movies:oldest', 'movies', text, [{ text: entry.movie.title, href: getMoviePath(entry.movie.tmdbId, entry.movie.slug) }], { href: getMoviePath(entry.movie.tmdbId, entry.movie.slug), relatedMovieIds: [entry.movie.tmdbId], priority: 5 })]; },
  (s) => { const dated = s.movies.map((movie) => ({ movie, time: dateValue(movie) })).filter((entry): entry is { movie: Movie; time: number } => entry.time !== null && entry.time <= s.now.getTime()).sort((a, b) => b.time - a.time); const entry = dated[0]; if (!entry) return []; const text = `The most recently released movie in the catalogue is ${entry.movie.title}.`; return [linkedFact('movies:newest-released', 'movies', text, [{ text: entry.movie.title, href: getMoviePath(entry.movie.tmdbId, entry.movie.slug) }], { href: getMoviePath(entry.movie.tmdbId, entry.movie.slug), relatedMovieIds: [entry.movie.tmdbId], priority: 5 })]; },
  (s) => { const count = s.movies.filter((movie) => { const date = dateValue(movie); return date !== null && date > s.now.getTime(); }).length; return count >= 5 ? [linkedFact('movies:upcoming', 'calendar', `${count} XmasDB movies have genuine release dates after today.`, [{ text: 'release calendar', href: '/calendar/' }], { priority: 4 })] : []; },
  (s) => { const month = s.now.getUTCMonth() + 1; const monthName = MONTHS[month - 1]; const article = /^[AEIOU]/.test(monthName) ? 'an' : 'a'; const count = s.movies.filter((movie) => movieDate(movie)?.slice(5, 7) === String(month).padStart(2, '0')).length; return count >= 3 ? [linkedFact('calendar:this-month', 'calendar', `Across all years, ${count} XmasDB movies have ${article} ${monthName} release date.`, [{ text: monthName, href: '/calendar/' }], { priority: 4 })] : []; },
  (s) => { const key = `${s.now.getUTCMonth() + 1}-${s.now.getUTCDate()}`; const movies = s.movies.filter((movie) => movieDate(movie)?.slice(5).replace(/^0/, '') === key); return movies.length >= 2 ? [fact('calendar:today-history', 'calendar', `Across all years, ${movies.length} XmasDB movies have a release date on this calendar date.`, { href: '/calendar/', relatedMovieIds: movies.map((movie) => movie.tmdbId), priority: 5 })] : []; },
  (s) => { const [month, count] = sortedCounts(countBy(s.movies.flatMap((movie) => { const date = movieDate(movie); return date ? [Number(date.slice(5, 7))] : []; })))[0] || []; return month ? [fact('movies:busiest-month', 'movies', `Across all years, ${count} XmasDB movies have a release date in ${MONTHS[month - 1]}, the busiest release month.`, { priority: 5 })] : []; },
  (s) => { const [date, count] = sortedCounts(countBy(s.movies.flatMap((movie) => { const value = movieDate(movie); return value ? [value.slice(5)] : []; })))[0] || []; const [month, day] = date?.split('-').map(Number) || []; return date && count >= 3 ? [fact('movies:busiest-date', 'calendar', `Across all years, ${count} XmasDB movies have a release date on ${MONTHS[month - 1]} ${day}.`, { href: '/calendar/', priority: 4 })] : []; },
  (s) => { const count = s.movies.filter((movie) => movieDate(movie)?.slice(5, 7) === '12').length; return count >= 10 ? [fact('movies:december', 'movies', `Across all years, ${count} XmasDB movies have a December release date.`, { priority: 3 })] : []; },
  (s) => { const count = s.movies.filter((movie) => { const date = movieDate(movie); return date ? ![10, 11, 12].includes(Number(date.slice(5, 7))) : false; }).length; return count >= 10 ? [fact('movies:off-season', 'movies', `Across all years, ${count} XmasDB movies have release dates outside the October–December Christmas season.`, { priority: 3 })] : []; },
  (s) => { const movie = [...s.movies].sort((a, b) => b.title.length - a.title.length || a.title.localeCompare(b.title))[0]; return movie ? [linkedFact('titles:longest', 'titles', `${movie.title} is the longest movie title in the XmasDB catalogue.`, [{ text: movie.title, href: getMoviePath(movie.tmdbId, movie.slug) }], { href: getMoviePath(movie.tmdbId, movie.slug), relatedMovieIds: [movie.tmdbId], priority: 3 })] : []; },
  (s) => { const movie = [...s.movies].filter((entry) => entry.title.trim().length >= 5).sort((a, b) => a.title.length - b.title.length || a.title.localeCompare(b.title))[0]; return movie ? [linkedFact('titles:shortest', 'titles', `${movie.title} is one of the shortest meaningful movie titles in XmasDB.`, [{ text: movie.title, href: getMoviePath(movie.tmdbId, movie.slug) }], { href: getMoviePath(movie.tmdbId, movie.slug), relatedMovieIds: [movie.tmdbId], priority: 2 })] : []; },
  (s) => { const count = s.movies.filter((movie) => /\bchristmas\b/i.test(movie.title)).length; return count >= 10 ? [fact('titles:christmas-word', 'titles', `${count} XmasDB titles contain the word “Christmas”.`, { priority: 4 })] : []; },
  (s) => { const count = s.movies.filter((movie) => /\bholiday\b/i.test(movie.title)).length; return count >= 10 ? [fact('titles:holiday-word', 'titles', `${count} XmasDB titles contain the word “Holiday”.`, { priority: 4 })] : []; },
  (s) => { const count = s.movies.filter((movie) => /\blove\b/i.test(movie.title)).length; return count >= 10 ? [fact('titles:love-word', 'titles', `${count} XmasDB titles contain the word “Love”.`, { priority: 3 })] : []; },
  (s) => { const [word, count] = sortedCounts(titleWords(s.movies))[0] || []; return word && count >= 8 ? [fact('titles:common-word', 'titles', `“${word[0].toUpperCase()}${word.slice(1)}” is the most common meaningful word in XmasDB movie titles, appearing ${count} times.`, { priority: 4 })] : []; },
  (s) => { const count = s.movies.filter((movie) => movie.alternativeTitles?.length).length; return count >= 10 ? [fact('titles:alternative-titles', 'titles', `${count} XmasDB movies have at least one alternative title.`, { priority: 4 })] : []; },
  (s) => { const [genre, count] = sortedCounts(countBy(s.movies.flatMap((movie) => (movie.genres || []).map((entry) => entry.name.trim()).filter(Boolean))))[0] || []; return genre && count >= 10 ? [fact('titles:common-genre', 'titles', `${genre} is the most common genre in XmasDB, appearing on ${count} movies.`, { priority: 3 })] : []; },
  (s) => { const movie = [...s.movies].sort((a, b) => (b.title.match(/[a-z][a-z']+/gi)?.length || 0) - (a.title.match(/[a-z][a-z']+/gi)?.length || 0) || a.title.localeCompare(b.title))[0]; const words = movie?.title.match(/[a-z][a-z']+/gi)?.length || 0; return movie && words >= 4 ? [titleLengthFact(movie, 'titles:most-words', `${movie.title} has the most words in a XmasDB movie title, with ${words}.`, 3)] : []; },
  (s) => { const entries = s.movies.map((movie) => ({ movie, words: movie.title.match(/[a-z][a-z']+/gi)?.length || 0 })).filter((entry) => entry.words >= 2).sort((a, b) => a.words - b.words || a.movie.title.length - b.movie.title.length || a.movie.title.localeCompare(b.movie.title)); const entry = entries[0]; return entry ? [titleLengthFact(entry.movie, 'titles:fewest-words', `${entry.movie.title} has the fewest words among meaningful multi-word XmasDB movie titles, with ${entry.words}.`, 2)] : []; },
  (s) => groupedTitleExtremes(s, 'network', true),
  (s) => groupedTitleExtremes(s, 'network', false),
  (s) => groupedTitleExtremes(s, 'year', true),
  (s) => groupedTitleExtremes(s, 'year', false),
  (s) => { const entries = runtimeEntries(s.movies); const entry = [...entries].sort((a, b) => b.runtime - a.runtime || a.movie.title.localeCompare(b.movie.title))[0]; if (!entry) return []; const text = `${entry.movie.title} has the longest listed runtime in XmasDB, at ${entry.runtime} minutes.`; return [linkedFact('runtime:longest', 'movies', text, [{ text: entry.movie.title, href: getMoviePath(entry.movie.tmdbId, entry.movie.slug) }], { href: getMoviePath(entry.movie.tmdbId, entry.movie.slug), relatedMovieIds: [entry.movie.tmdbId], priority: 4 })]; },
  (s) => { const entries = runtimeEntries(s.movies); const entry = [...entries].sort((a, b) => a.runtime - b.runtime || a.movie.title.localeCompare(b.movie.title))[0]; if (!entry) return []; const text = `${entry.movie.title} has the shortest listed runtime in XmasDB, at ${entry.runtime} minutes.`; return [linkedFact('runtime:shortest', 'movies', text, [{ text: entry.movie.title, href: getMoviePath(entry.movie.tmdbId, entry.movie.slug) }], { href: getMoviePath(entry.movie.tmdbId, entry.movie.slug), relatedMovieIds: [entry.movie.tmdbId], priority: 2 })]; },
  (s) => { const entries = runtimeEntries(s.movies); return entries.length >= MIN_RUNTIME_AVERAGE_SAMPLE ? [fact('runtime:average', 'movies', `Christmas movies in XmasDB average ${roundedAverage(entries.map((entry) => entry.runtime))} minutes.`, { priority: 3 })] : []; },
  (s) => { const [runtime, count] = sortedCounts(countBy(runtimeEntries(s.movies).map((entry) => entry.runtime)))[0] || []; return runtime && count >= 5 ? [fact('runtime:common', 'movies', `${runtime} minutes is the most common listed runtime in XmasDB, for ${count} movies.`, { priority: 3 })] : []; },
  (s) => groupedRuntimeExtremes(s, 'network', true),
  (s) => groupedRuntimeExtremes(s, 'network', false),
  (s) => groupedRuntimeExtremes(s, 'year', true),
  (s) => groupedRuntimeExtremes(s, 'year', false),
  (s) => { const facts: TriviaFact[] = []; NETWORK_IDS.forEach((network) => { const entries = runtimeEntries(s.movies.filter((movie) => movie.brandId === network)); if (entries.length >= MIN_RUNTIME_AVERAGE_SAMPLE) { const label = networkLabel(network); const text = `${label} Christmas movies average ${roundedAverage(entries.map((entry) => entry.runtime))} minutes in XmasDB.`; facts.push(linkedFact(`runtime:average-network:${network}`, 'networks', text, [{ text: label, href: getNetworkPath(network) }], { priority: 2 })); } }); return facts; },
  (s) => { const byYear = new Map<number, number[]>(); runtimeEntries(s.movies).forEach((entry) => { const year = movieYear(entry.movie); if (year) byYear.set(year, [...(byYear.get(year) || []), entry.runtime]); }); return [...byYear.entries()].filter(([, values]) => values.length >= MIN_RUNTIME_AVERAGE_SAMPLE).map(([year, values]) => { const text = `Christmas movies from ${year} average ${roundedAverage(values)} minutes in XmasDB.`; return linkedFact(`runtime:average-year:${year}`, 'movies', text, [{ text: String(year), href: getYearPath(year) }], { priority: 2 }); }); },
  (s) => { const directors = new Set(s.movies.flatMap((movie) => getCreativeCrew(movie.crew).filter((member) => member.job === 'Director').map((member) => member.id))); const writers = new Set(s.movies.flatMap((movie) => getCreativeCrew(movie.crew).filter((member) => ['Writer', 'Screenplay', 'Story'].includes(member.job)).map((member) => member.id))); const credits = new Set(s.movies.flatMap((movie) => uniqueCast(movie).map((id) => `${movie.tmdbId}:${id}`))); return [fact('catalogue:acting-credits', 'movies', `The XmasDB catalogue contains ${credits.size.toLocaleString()} acting credits across its movies.`, { priority: 3 }), fact('catalogue:directors', 'crew', `${directors.size.toLocaleString()} directors have credits in the XmasDB catalogue.`, { priority: 3 }), fact('catalogue:writers', 'crew', `${writers.size.toLocaleString()} writers have credits in the XmasDB catalogue.`, { priority: 3 })]; },
  (s) => { const known = s.actors.filter((actor) => parseBirthday(actor.birthday)).length; return [fact('actors:known-dob', 'actors', `${known.toLocaleString()} XmasDB actors have a listed birth date.`, { href: '/birthdays/', priority: 3 }), fact('actors:unknown-dob', 'actors', `${(s.actors.length - known).toLocaleString()} XmasDB actors do not have a listed birth date.`, { href: '/birthdays/', priority: 2 })]; },
  (s) => { const portraits = s.actors.filter((actor) => actor.photoUrl?.startsWith('/images/people/')).length; return [fact('actors:portraits', 'actors', `${portraits.toLocaleString()} XmasDB actors have profile photos.`, { href: '/birthdays/', priority: 3 }), fact('actors:no-portraits', 'actors', `${(s.actors.length - portraits).toLocaleString()} XmasDB actors do not have profile photos.`, { href: '/birthdays/', priority: 2 }), fact('actors:portrait-percentage', 'actors', `${percent(portraits, s.actors.length)} of XmasDB actors have profile photos.`, { href: '/birthdays/', priority: 3 })]; },
  (s) => { const known = s.actors.filter((actor) => parseBirthday(actor.birthday)).length; return known ? [fact('actors:dob-percentage', 'actors', `${percent(known, s.actors.length)} of XmasDB actors have a listed birth date.`, { href: '/birthdays/', priority: 3 })] : []; },
  (s) => { const male = s.actors.filter((actor) => actor.gender === 'Male').length; const female = s.actors.filter((actor) => actor.gender === 'Female').length; const unknown = s.actors.length - male - female; const recorded = male + female; return [fact('gender:male', 'actors', `${male.toLocaleString()} XmasDB actors are listed as male.`, { priority: 2 }), fact('gender:female', 'actors', `${female.toLocaleString()} XmasDB actors are listed as female.`, { priority: 2 }), fact('gender:unknown', 'actors', `${unknown.toLocaleString()} XmasDB actors have no listed gender.`, { priority: 2 }), ...(recorded ? [fact('gender:breakdown', 'actors', `Among actors with a listed gender, ${percent(male, recorded)} are male and ${percent(female, recorded)} are female.`, { priority: 2 })] : [])]; },
  (s) => { const posters = s.movies.filter((movie) => getMoviePoster(movie)).length; return [fact('posters:count', 'movies', `${posters.toLocaleString()} XmasDB movies have posters.`, { href: getMoviesPath(), priority: 3 }), fact('posters:percentage', 'movies', `${percent(posters, s.movies.length)} of the XmasDB catalogue has posters.`, { href: getMoviesPath(), priority: 3 }), fact('posters:missing', 'movies', `${(s.movies.length - posters).toLocaleString()} XmasDB movies do not have posters.`, { href: getMoviesPath(), priority: 2 })]; },
  (s) => { const facts: TriviaFact[] = []; NETWORK_IDS.forEach((network) => { const movies = s.movies.filter((movie) => movie.brandId === network); const posters = movies.filter((movie) => getMoviePoster(movie)).length; if (movies.length >= MIN_GROUP_PERCENTAGE_SAMPLE) { const label = networkLabel(network); const text = `${label} has posters for ${percent(posters, movies.length)} of its XmasDB movies.`; facts.push(linkedFact(`posters:network:${network}`, 'networks', text, [{ text: label, href: getNetworkPath(network) }], { priority: 2 })); } }); return facts; },
  (s) => { const byYear = new Map<number, Movie[]>(); s.movies.forEach((movie) => { const year = movieYear(movie); if (year) byYear.set(year, [...(byYear.get(year) || []), movie]); }); return [...byYear.entries()].filter(([, movies]) => movies.length >= MIN_GROUP_PERCENTAGE_SAMPLE).map(([year, movies]) => { const posters = movies.filter((movie) => getMoviePoster(movie)).length; const text = `${percent(posters, movies.length)} of the ${year} XmasDB movies have posters.`; return linkedFact(`posters:year:${year}`, 'movies', text, [{ text: String(year), href: getYearPath(year) }], { priority: 2 }); }); },
  (s) => { const birthdayPortraits = birthdayEntries(s).filter((entry) => entry.actor.photoUrl?.startsWith('/images/people/')).length; return birthdayPortraits ? [fact('posters:birthday-portraits', 'birthdays', `${birthdayPortraits.toLocaleString()} XmasDB actors with birthdays have profile photos.`, { href: '/birthdays/', priority: 2 })] : []; },
  (s) => topActorFact(s, 3, 'actors:most-movies', (name, count) => `${name} appears in ${count} Christmas movies in the XmasDB collection.`),
  (s) => topActorFact(s, 5, 'actors:prolific', (name, count) => `${name} is one of XmasDB's most prolific Christmas stars, appearing in ${count} movies.`),
  (s) => { const entries = s.actors.filter((actor) => parseBirthday(actor.birthday)); const actor = [...entries].sort((a, b) => (b.birthday || '').localeCompare(a.birthday || ''))[0]; if (!actor || entries.length < 20) return []; const text = `Among XmasDB actors with a listed birth date, ${actor.name} is the youngest.`; return [linkedFact('actors:youngest-known', 'actors', text, [{ text: actor.name, href: getActorPath(actor.tmdbPersonId, actor.slug) }], { href: getActorPath(actor.tmdbPersonId, actor.slug), relatedActorIds: [actor.tmdbPersonId], priority: 4 })]; },
  (s) => { const entries = s.actors.filter((actor) => parseBirthday(actor.birthday)); const actor = [...entries].sort((a, b) => (a.birthday || '').localeCompare(b.birthday || ''))[0]; if (!actor || entries.length < 20) return []; const text = `Among XmasDB actors with a listed birth date, ${actor.name} is the oldest.`; return [linkedFact('actors:oldest-known', 'actors', text, [{ text: actor.name, href: getActorPath(actor.tmdbPersonId, actor.slug) }], { href: getActorPath(actor.tmdbPersonId, actor.slug), relatedActorIds: [actor.tmdbPersonId], priority: 4 })]; },
  (s) => { const map = actorMovies(s); const spans = [...map.entries()].map(([id, movies]) => { const years = movies.map((movie) => movieDate(movie)).filter((date): date is string => Boolean(date)).map((date) => Number(date.slice(0, 4))); return { id, span: years.length > 1 ? Math.max(...years) - Math.min(...years) : 0, first: Math.min(...years), last: Math.max(...years) }; }).filter((entry) => entry.span >= 5).sort((a, b) => b.span - a.span); const entry = spans[0]; if (!entry) return []; const name = actorName(entry.id, s); const text = `${name} has the longest XmasDB Christmas-movie span: ${entry.span} years.`; return [linkedFact('actors:career-span', 'actors', text, [{ text: name, href: actorLink(entry.id, s) }], { href: actorLink(entry.id, s), relatedActorIds: [entry.id], priority: 5 })]; },
  (s) => { const map = actorMovies(s); const gaps = [...map.entries()].flatMap(([id, movies]) => { const years = [...new Set(movies.map((movie) => movieDate(movie)).filter((date): date is string => Boolean(date)).map((date) => Number(date.slice(0, 4))))].sort((a, b) => a - b); return years.slice(1).map((year, index) => ({ id, gap: year - years[index - 1] })); }).filter((entry) => entry.gap >= 5).sort((a, b) => b.gap - a.gap); const entry = gaps[0]; if (!entry) return []; const name = actorName(entry.id, s); const text = `${name} has a ${entry.gap}-year gap between XmasDB appearances.`; return [linkedFact('actors:largest-gap', 'actors', text, [{ text: name, href: actorLink(entry.id, s) }], { href: actorLink(entry.id, s), relatedActorIds: [entry.id], priority: 3 })]; },
    (s) => { const map = actorMovies(s); const entries = [...map.entries()].map(([id, movies]) => ({ id, year: sortedCounts(countBy(movies.map((movie) => Number(movieDate(movie)?.slice(0, 4))).filter((year): year is number => Boolean(year))))[0] })).filter((entry) => entry.year && entry.year[1] >= MIN_SAME_YEAR_MOVIES).sort((left, right) => right.year[1] - left.year[1] || left.id - right.id); return entries.slice(0, 10).map((entry, index) => { const name = actorName(entry.id, s); const text = `${name} appears in ${entry.year[1]} XmasDB movies in ${entry.year[0]}.`; return linkedFact(`actors:same-year:${entry.id}`, 'actors', text, [{ text: name, href: actorLink(entry.id, s) }], { href: actorLink(entry.id, s), relatedActorIds: [entry.id], priority: Math.max(2, Math.min(10, entry.year[1])) - index }); }); },
   (s) => { const map = actorMovies(s); return [...map.entries()].map(([id, movies]) => ({ id, networks: new Set(movies.map((movie) => movie.brandId)) })).filter((entry) => entry.networks.size >= 2).sort((a, b) => b.networks.size - a.networks.size).slice(0, 10).map((entry) => { const name = actorName(entry.id, s); const text = `${name} has appeared across ${entry.networks.size} Christmas networks in XmasDB.`; return linkedFact(`actors:multi-network:${entry.id}`, 'networks', text, [{ text: name, href: actorLink(entry.id, s) }], { href: actorLink(entry.id, s), relatedActorIds: [entry.id], priority: 3 }); }); },
   (s) => { const map = actorMovies(s); return [...map.entries()].map(([id, movies]) => ({ id, networks: new Set(movies.map((movie) => movie.brandId)) })).filter((entry) => NETWORK_IDS.every((network) => entry.networks.has(network))).map((entry) => { const name = actorName(entry.id, s); const text = `${name} has appeared on all four major Christmas networks represented in XmasDB.`; return linkedFact(`actors:all-networks:${entry.id}`, 'networks', text, [{ text: name, href: actorLink(entry.id, s) }], { href: actorLink(entry.id, s), relatedActorIds: [entry.id], priority: 7 }); }); },
  (s) => { const entries = birthdayEntries(s).filter((entry) => entry.month === s.now.getMonth() + 1 && entry.day === s.now.getDate()); return entries.length ? [fact('birthdays:today', 'birthdays', `${entries.length} XmasDB ${entries.length === 1 ? 'star has' : 'stars have'} a birthday today.`, { href: '/birthdays/', relatedActorIds: entries.map((entry) => entry.actor.tmdbPersonId), priority: 9 })] : []; },
  (s) => { const tomorrow = new Date(s.now.getTime() + 86400000); const entries = birthdayEntries(s).filter((entry) => entry.month === tomorrow.getMonth() + 1 && entry.day === tomorrow.getDate()); return entries.length ? [fact('birthdays:tomorrow', 'birthdays', `${entries.length} XmasDB ${entries.length === 1 ? 'star has' : 'stars have'} a birthday tomorrow.`, { href: '/birthdays/', relatedActorIds: entries.map((entry) => entry.actor.tmdbPersonId), priority: 6 })] : []; },
  (s) => { const entries = birthdayEntries(s).filter((entry) => { const distance = Math.floor((Date.UTC(2000, entry.month - 1, entry.day) - Date.UTC(2000, s.now.getMonth(), s.now.getDate())) / 86400000); return distance >= 0 && distance <= 7; }); return entries.length >= 2 ? [fact('birthdays:week', 'birthdays', `${entries.length} XmasDB stars have birthdays in the next week.`, { href: '/birthdays/', relatedActorIds: entries.map((entry) => entry.actor.tmdbPersonId), priority: 5 })] : []; },
  (s) => { const count = birthdayEntries(s).filter((entry) => entry.month === s.now.getMonth() + 1).length; return count >= 10 ? [fact('birthdays:month', 'birthdays', `${count} XmasDB stars have birthdays in ${MONTHS[s.now.getMonth()]}.`, { href: '/birthdays/', priority: 5 })] : []; },
  (s) => { const [month, count] = sortedCounts(countBy(birthdayEntries(s).map((entry) => entry.month)))[0] || []; return month && count >= 20 ? [fact('birthdays:busiest-month', 'birthdays', `${MONTHS[month - 1]} is the most common birth month among XmasDB stars, with ${count} known birthdays.`, { href: '/birthdays/', priority: 4 })] : []; },
  (s) => { const [date, count] = sortedCounts(countBy(birthdayEntries(s).map((entry) => `${entry.month}-${entry.day}`)))[0] || []; return date && count >= 2 ? [fact('birthdays:common-date', 'birthdays', `${count} XmasDB stars share the same birthday date: ${date.replace('-', '/')}.`, { href: '/birthdays/', priority: 3 })] : []; },
  (s) => { const entries = birthdayEntries(s).filter((entry) => (entry.month === 12 && (entry.day === 24 || entry.day === 25)) || (entry.month === 1 && entry.day === 1)); return entries.length >= 2 ? [fact('birthdays:holiday-dates', 'birthdays', `${entries.length} XmasDB stars have birthdays on Christmas Eve, Christmas Day or New Year's Day.`, { href: '/birthdays/', relatedActorIds: entries.map((entry) => entry.actor.tmdbPersonId), priority: 4 })] : []; },
  (s) => { const entries = s.movies.flatMap((movie) => movie.cast.map((member) => normalizeCharacterFirstName(member.character)).filter((name): name is string => Boolean(name))); const [name, entry] = [...characterNameCounts(entries).entries()].sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))[0] || []; return name && entry.count >= 8 ? [fact('characters:common-first-name', 'characters', `${entry.display} is the most common character first name in XmasDB, appearing ${entry.count} times across the catalogue.`, { priority: 5 })] : []; },
  (s) => { const entries = s.movies.flatMap((movie) => movie.cast.map((member) => normalizeCharacterName(member.character)).filter((name): name is string => Boolean(name))); const [name, entry] = [...characterNameCounts(entries).entries()].sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))[0] || []; return name && entry.count >= 3 ? [fact('characters:common-full-name', 'characters', `The character name ${entry.display} appears in ${entry.count} XmasDB movies.`, { priority: 3 })] : []; },
  (s) => { const actorNames = new Map<number, Map<string, Set<number>>>(); s.movies.forEach((movie) => movie.cast.forEach((member) => { const first = normalizeCharacterFirstName(member.character); const id = personId(member); if (first && id) { const byName = actorNames.get(id) || new Map<string, Set<number>>(); const key = characterNameKey(first); const movies = byName.get(key) || new Set<number>(); movies.add(movie.tmdbId); byName.set(key, movies); actorNames.set(id, byName); } })); return [...actorNames.entries()].flatMap(([id, names]) => [...names.entries()].filter(([, movies]) => movies.size >= 3).map(([name, movies]) => { const actor = actorName(id, s); const text = `${actor} has played characters named ${formatCharacterName(name)} in ${movies.size} XmasDB movies.`; return linkedFact(`characters:actor-repeat:${id}:${slug(name)}`, 'characters', text, [{ text: actor, href: actorLink(id, s) }], { href: actorLink(id, s), relatedActorIds: [id], relatedMovieIds: [...movies], priority: 4 }); })).slice(0, 20); },
  (s) => { const entries = new Map<string, { display: string; movies: Set<number> }>(); s.movies.forEach((movie) => movie.cast.forEach((member) => { const name = normalizeCharacterName(member.character); if (name) { const key = characterNameKey(name); const current = entries.get(key) || { display: formatCharacterName(name), movies: new Set<number>() }; current.movies.add(movie.tmdbId); entries.set(key, current); } })); return [...entries.entries()].filter(([, entry]) => entry.movies.size >= 3).slice(0, 15).map(([name, entry]) => fact(`characters:recurring:${slug(name)}`, 'characters', `The character name ${entry.display} appears in ${entry.movies.size} XmasDB movies.`, { relatedMovieIds: [...entry.movies], priority: 2 })); },
  (s) => { const pairs = new Map<string, { ids: [number, number]; movies: Set<number> }>(); s.movies.forEach((movie) => { const ids = uniqueCast(movie).sort((a, b) => a - b); for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) { const key = `${ids[i]}:${ids[j]}`; const entry = pairs.get(key) || { ids: [ids[i], ids[j]], movies: new Set<number>() }; entry.movies.add(movie.tmdbId); pairs.set(key, entry); } }); return [...pairs.values()].filter((entry) => entry.movies.size >= 3).sort((a, b) => b.movies.size - a.movies.size).slice(0, 20).map((entry) => { const first = actorName(entry.ids[0], s); const second = actorName(entry.ids[1], s); const text = `${first} and ${second} have appeared together in ${entry.movies.size} XmasDB movies.`; return linkedFact(`co-stars:pair:${entry.ids.join('-')}`, 'co-stars', text, [{ text: first, href: actorLink(entry.ids[0], s) }, { text: second, href: actorLink(entry.ids[1], s) }], { relatedActorIds: entry.ids, relatedMovieIds: [...entry.movies], priority: entry.movies.size >= 5 ? 8 : 4 }); }); },
  (s) => { const pairs = new Map<number, Set<number>>(); const movieSets = new Map<number, Set<number>>(); s.movies.forEach((movie) => { const ids = uniqueCast(movie); ids.forEach((id) => movieSets.set(id, new Set([...(movieSets.get(id) || []), movie.tmdbId]))); for (const a of ids) for (const b of ids) if (a !== b) pairs.set(a, new Set([...(pairs.get(a) || []), b])); }); return [...pairs.entries()].map(([id, coStars]) => ({ id, count: coStars.size, movies: movieSets.get(id)?.size || 0 })).filter((entry) => entry.count >= 4 && entry.movies >= 5).sort((a, b) => b.count - a.count).slice(0, 10).map((entry) => { const name = actorName(entry.id, s); const text = `${name} has recurring screen partnerships with ${entry.count} different XmasDB co-stars.`; return linkedFact(`co-stars:recurring:${entry.id}`, 'co-stars', text, [{ text: name, href: actorLink(entry.id, s) }], { href: actorLink(entry.id, s), relatedActorIds: [entry.id], priority: 3 }); }); },
  (s) => { const pairs = new Map<string, { ids: [number, number]; years: number[] }>(); s.movies.forEach((movie) => { const year = Number(movieDate(movie)?.slice(0, 4)); if (!year) return; const ids = uniqueCast(movie).sort((a, b) => a - b); for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) { const key = `${ids[i]}:${ids[j]}`; const entry = pairs.get(key) || { ids: [ids[i], ids[j]], years: [] }; entry.years.push(year); pairs.set(key, entry); } }); const entry = [...pairs.values()].map((value) => ({ ...value, span: Math.max(...value.years) - Math.min(...value.years) })).filter((value) => value.years.length >= 3 && value.span >= 4).sort((a, b) => b.span - a.span)[0]; if (!entry) return []; const first = actorName(entry.ids[0], s); const second = actorName(entry.ids[1], s); const text = `${first} and ${second} have shared XmasDB credits across ${entry.span} years.`; return [linkedFact('co-stars:long-span', 'co-stars', text, [{ text: first, href: actorLink(entry.ids[0], s) }, { text: second, href: actorLink(entry.ids[1], s) }], { relatedActorIds: entry.ids, priority: 4 })]; },
  (s) => { const counts = countBy(s.movies.flatMap((movie) => getCreativeCrew(movie.crew).filter((member) => member.job === 'Director').map((member) => member.id))); return sortedCounts(counts).filter(([, count]) => count >= 3).slice(0, 10).map(([id, count]) => { const name = actorName(id, s); const text = `${name} has directed ${count} Christmas movies in XmasDB.`; return linkedFact(`crew:director:${id}`, 'crew', text, [{ text: name, href: actorLink(id, s) }], { href: actorLink(id, s), relatedActorIds: [id], priority: 4 }); }); },
  (s) => { const counts = countBy(s.movies.flatMap((movie) => getCreativeCrew(movie.crew).filter((member) => ['Writer', 'Screenplay', 'Story'].includes(member.job)).map((member) => member.id))); return sortedCounts(counts).filter(([, count]) => count >= 3).slice(0, 10).map(([id, count]) => { const name = actorName(id, s); const text = `${name} has writing credits on ${count} Christmas movies in XmasDB.`; return linkedFact(`crew:writer:${id}`, 'crew', text, [{ text: name, href: actorLink(id, s) }], { href: actorLink(id, s), relatedActorIds: [id], priority: 4 }); }); },
  (s) => { const acting = new Set(s.movies.flatMap((movie) => uniqueCast(movie))); const creative = new Map<number, Set<string>>(); s.movies.forEach((movie) => getCreativeCrew(movie.crew).forEach((member) => creative.set(member.id, new Set([...(creative.get(member.id) || []), member.job])))); return [...creative.entries()].filter(([id]) => acting.has(id)).slice(0, 20).map(([id]) => { const name = actorName(id, s); const text = `${name} has both acting and creative crew credits in the XmasDB catalogue.`; return linkedFact(`crew:dual-role:${id}`, 'crew', text, [{ text: name, href: actorLink(id, s) }], { href: actorLink(id, s), relatedActorIds: [id], priority: 3 }); }); },
  (s) => { const combinations = new Map<string, { actor: number; director: number; movies: Set<number> }>(); s.movies.forEach((movie) => getCreativeCrew(movie.crew).filter((member) => member.job === 'Director').forEach((director) => uniqueCast(movie).forEach((actor) => { const key = `${director.id}:${actor}`; const entry = combinations.get(key) || { actor, director: director.id, movies: new Set<number>() }; entry.movies.add(movie.tmdbId); combinations.set(key, entry); }))); return [...combinations.values()].filter((entry) => entry.movies.size >= 2).sort((a, b) => b.movies.size - a.movies.size).slice(0, 15).map((entry) => { const actor = actorName(entry.actor, s); const director = actorName(entry.director, s); const text = `${actor} has worked with director ${director} on ${entry.movies.size} XmasDB movies.`; return linkedFact(`crew:director-actor:${entry.director}:${entry.actor}`, 'crew', text, [{ text: actor, href: actorLink(entry.actor, s) }, { text: director, href: actorLink(entry.director, s) }], { relatedActorIds: [entry.actor, entry.director], relatedMovieIds: [...entry.movies], priority: 3 }); }); },
  (s) => { const byNetwork = NETWORK_IDS.flatMap((network) => { const counts = countBy(s.movies.filter((movie) => movie.brandId === network).flatMap((movie) => uniqueCast(movie))); const [id, count] = sortedCounts(counts)[0] || []; if (!id || count < 3) return []; const name = actorName(id, s); const label = networkLabel(network); const text = `${name} has the most ${label} appearances in XmasDB, with ${count} movies.`; return [linkedFact(`networks:actor:${network}:${id}`, 'networks', text, [{ text: name, href: actorLink(id, s) }, { text: label, href: getNetworkPath(network) }], { href: actorLink(id, s), relatedActorIds: [id], priority: 3 })]; }); return byNetwork; },
];

export const TRIVIA_GENERATORS = generators;

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

function rotationOrder(pool: TriviaFact[], seed: string): TriviaFact[] {
  const groups = new Map<string, TriviaFact[]>();
  pool.forEach((entry) => groups.set(entry.category, [...(groups.get(entry.category) || []), entry]));
  groups.forEach((entries, category) => entries.sort((left, right) => hash(`${seed}:${category}:${left.id}`) - hash(`${seed}:${category}:${right.id}`) || left.id.localeCompare(right.id)));
  const categories = [...groups.keys()].sort((left, right) => hash(`${seed}:category:${left}`) - hash(`${seed}:category:${right}`) || left.localeCompare(right));
  const totals = new Map(categories.map((category) => [category, groups.get(category)!.length]));
  const emitted = new Map<string, number>();
  const order: TriviaFact[] = [];
  let previousCategory = '';
  while (order.length < pool.length) {
    const available = categories.filter((category) => (groups.get(category)?.length || 0) > 0 && category !== previousCategory);
    const candidates = available.length ? available : categories.filter((category) => (groups.get(category)?.length || 0) > 0);
    const category = candidates.sort((left, right) => {
      return (((emitted.get(left) || 0) + 0.5) * pool.length / totals.get(left)!) - (((emitted.get(right) || 0) + 0.5) * pool.length / totals.get(right)!) || categories.indexOf(left) - categories.indexOf(right);
    })[0];
    if (!category) break;
    order.push(groups.get(category)!.shift()!);
    emitted.set(category, (emitted.get(category) || 0) + 1);
    previousCategory = category;
  }
  return order;
}

let cachedGlobal: { day: string; facts: TriviaFact[] } | null = null;

export function generateTriviaFacts(movies: Movie[], actors: Actor[], now: Date = new Date()): TriviaFact[] {
  const source = { movies, actors, now };
  const facts = generators.flatMap((generator) => generator(source)).filter((entry) => entry.text.trim().length > 0 && entry.id.trim().length > 0);
  return facts.filter((entry, index) => facts.findIndex((candidate) => candidate.id === entry.id) === index);
}

export function getTriviaFacts(now: Date = new Date()): TriviaFact[] {
  const day = now.toISOString().slice(0, 10);
  if (!cachedGlobal || cachedGlobal.day !== day) {
    cachedGlobal = { day, facts: generateTriviaFacts(MOVIES, getAllActors(), now) };
  }
  return cachedGlobal.facts;
}

function contextualFacts(context: TriviaContext, source: TriviaSource): TriviaFact[] {
  const facts: TriviaFact[] = [];
  if (context.actor) {
    const movies = actorMovies(source).get(context.actor.tmdbPersonId) || [];
    if (movies.length >= 3) facts.push(linkedFact(`context:actor:movies:${context.actor.tmdbPersonId}`, 'actors', `${context.actor.name} appears in ${movies.length} Christmas movies in XmasDB.`, [{ text: context.actor.name, href: getActorPath(context.actor.tmdbPersonId, context.actor.slug) }], { href: getActorPath(context.actor.tmdbPersonId, context.actor.slug), relatedActorIds: [context.actor.tmdbPersonId], priority: 7 }));
    const brands = new Set(movies.map((movie) => movie.brandId));
    if (brands.size >= 2) facts.push(linkedFact(`context:actor:networks:${context.actor.tmdbPersonId}`, 'networks', `${context.actor.name} has appeared across ${brands.size} Christmas networks in XmasDB.`, [{ text: context.actor.name, href: getActorPath(context.actor.tmdbPersonId, context.actor.slug) }], { href: getActorPath(context.actor.tmdbPersonId, context.actor.slug), relatedActorIds: [context.actor.tmdbPersonId], priority: 6 }));
    const birthday = parseBirthday(context.actor.birthday);
    if (birthday) facts.push(linkedFact(`context:actor:birth-month:${context.actor.tmdbPersonId}`, 'birthdays', `${context.actor.name} is one of the XmasDB stars born in ${MONTHS[birthday.month - 1]}.`, [{ text: context.actor.name, href: getActorPath(context.actor.tmdbPersonId, context.actor.slug) }], { href: '/birthdays/', relatedActorIds: [context.actor.tmdbPersonId], priority: 4 }));
  }
  if (context.movie) {
    const ids = uniqueCast(context.movie);
    if (ids.length >= 2) facts.push(linkedFact(`context:movie:cast:${context.movie.tmdbId}`, 'movies', `${context.movie.title} has ${ids.length} cast members in its XmasDB entry.`, [{ text: context.movie.title, href: getMoviePath(context.movie.tmdbId, context.movie.slug) }], { href: getMoviePath(context.movie.tmdbId, context.movie.slug), relatedMovieIds: [context.movie.tmdbId], priority: 3 }));
    if (context.movie.networkPremiereDate && context.movie.releaseDate !== context.movie.networkPremiereDate) facts.push(linkedFact(`context:movie:network-date:${context.movie.tmdbId}`, 'calendar', `${context.movie.title} has a network premiere date separate from its release date.`, [{ text: context.movie.title, href: getMoviePath(context.movie.tmdbId, context.movie.slug) }], { href: '/calendar/', relatedMovieIds: [context.movie.tmdbId], priority: 5 }));
    const genre = context.movie.genres?.find((entry) => entry.name.trim());
    if (genre) facts.push(linkedFact(`context:movie:genre:${context.movie.tmdbId}`, 'titles', `${context.movie.title} is listed as a ${genre.name.toLowerCase()} movie.`, [{ text: context.movie.title, href: getMoviePath(context.movie.tmdbId, context.movie.slug) }], { href: getMoviePath(context.movie.tmdbId, context.movie.slug), relatedMovieIds: [context.movie.tmdbId], priority: 2 }));
  }
  return facts;
}

export function selectTriviaFact(now: Date = new Date(), context: TriviaContext = {}): TriviaFact | null {
  const global = getTriviaFacts(now);
  const source = { movies: MOVIES, actors: getAllActors(), now };
  const contextual = contextualFacts(context, source);
  const pool = [...contextual, ...global];
  if (!pool.length) return null;
  const slot = Math.floor(now.getTime() / (5 * 60 * 1000));
  const day = now.toISOString().slice(0, 10);
  const order = rotationOrder(pool, `${day}:${context.actor?.tmdbPersonId || ''}:${context.movie?.tmdbId || ''}`);
  return order[slot % order.length] || pool[slot % pool.length];
}
