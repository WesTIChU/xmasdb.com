import { getPublicMovies } from './public-movies.js';

const parseBirthday = birthday => {
  const match = String(birthday || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year: Number(String(birthday).slice(0, 4)), month, day };
};

const dateOnly = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const isLeapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export function getBirthdayOccurrence(birthday, from = new Date()) {
  const parsed = parseBirthday(birthday);
  if (!parsed) return null;
  const today = dateOnly(from);
  let year = today.getFullYear();
  let day = parsed.day;
  if (parsed.month === 2 && parsed.day === 29 && !isLeapYear(year)) day = 28;
  let occurrence = new Date(year, parsed.month - 1, day);
  if (occurrence <= today) {
    year += 1;
    day = parsed.month === 2 && parsed.day === 29 && !isLeapYear(year) ? 28 : parsed.day;
    occurrence = new Date(year, parsed.month - 1, day);
  }
  return occurrence;
}

export function isBirthdayToday(birthday, date = new Date()) {
  const parsed = parseBirthday(birthday);
  if (!parsed) return false;
  return parsed.month === date.getMonth() + 1 &&
    (parsed.day === date.getDate() || (parsed.month === 2 && parsed.day === 29 && date.getDate() === 28 && !isLeapYear(date.getFullYear())));
}

export function getBirthdayAge(birthday, year) {
  const parsed = parseBirthday(birthday);
  return parsed ? year - parsed.year : null;
}

export function getPublicActors(collectionMovies, comingSoonMovies, castData) {
  const actors = new Map();
  const movieIdsByActor = new Map();
  const catalog = getPublicMovies(collectionMovies, comingSoonMovies);
  const metadata = new Map((castData?.actors || []).map(actor => [String(actor.id), actor]));

  for (const movie of catalog) {
    const id = String(movie.tmdbId || movie.tmdb_id || '');
    const cast = castData?.castByMovieId?.[id] || castData?.movieCast?.[id] || movie.cast || [];
    for (const person of cast) {
      if (!person?.id || !person.name) continue;
      const actorId = String(person.id);
      const actor = { ...(metadata.get(actorId) || {}), ...person, id: person.id, name: person.name };
      actors.set(actorId, actor);
      if (!movieIdsByActor.has(actorId)) movieIdsByActor.set(actorId, new Set());
      movieIdsByActor.get(actorId).add(id);
    }
  }

  return [...actors.values()].map(actor => ({
    ...actor,
    movieCount: movieIdsByActor.get(String(actor.id))?.size || 0
  }));
}

export function getBirthdayGroups(actors, now = new Date(), limit = 7) {
  const today = actors.filter(actor => actor.birthday && isBirthdayToday(actor.birthday, now))
    .sort((a, b) => a.name.localeCompare(b.name));
  const upcoming = new Map();
  for (const actor of actors) {
    if (!actor.birthday || isBirthdayToday(actor.birthday, now)) continue;
    const occurrence = getBirthdayOccurrence(actor.birthday, now);
    if (!occurrence) continue;
    const key = `${occurrence.getFullYear()}-${occurrence.getMonth() + 1}-${occurrence.getDate()}`;
    if (!upcoming.has(key)) upcoming.set(key, { date: occurrence, actors: [] });
    upcoming.get(key).actors.push(actor);
  }
  const dates = [...upcoming.values()].sort((a, b) => a.date - b.date).slice(0, limit);
  dates.forEach(group => group.actors.sort((a, b) => a.name.localeCompare(b.name)));
  return { today, upcoming: dates };
}
