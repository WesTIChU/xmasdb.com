import 'dotenv/config';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { Movie } from '../src/types';
import { fetchTmdbMovie, requireTmdbApiKey, searchTmdbMovies } from '../src/utils/tmdb';
import { enrichCataloguePeople } from '../src/utils/person-enrichment';
import { cacheLocalImage } from '../src/utils/local-images';
import { writeFileAtomically } from '../src/utils/atomic-file';

const MOVIES_PATH = path.join(process.cwd(), 'src/data/movies.ts');
const PENDING_PATH = path.join(process.cwd(), 'src/data/hallmark-2026-pending-report.json');
const REPORT_PATH = path.join(process.cwd(), 'src/data/hallmark-2026-import-report.json');

const APPROVED_MOVIES = [
  ["'Tis the Season for Setups", '2026-10-16'],
  ['Holiday Touchdown: A Bears Love Story', '2026-10-17'],
  ['Mr. & Mrs. Christmas', '2026-10-18'],
  ['Winter Wonderlanes', '2026-10-23'],
  ['Forgotten Holiday', '2026-10-24'],
  ['What If Christmas', '2026-10-25'],
  ["Who's Coming for Christmas?", '2026-10-30'],
  ['Adopting St. Nick', '2026-10-31'],
  ['A Danish Christmas', '2026-11-01'],
  ['Merry Memories', '2026-11-06'],
  ['Holiday Unplugged', '2026-11-07'],
  ['A Season of Promises', '2026-11-08'],
  ['My Christmas Cowboy', '2026-11-13'],
  ['The Nights Before Christmas', '2026-11-14'],
  ['Mistletoe and Mimosas', '2026-11-15'],
  ['Our Holiday Playbook', '2026-11-20'],
  ['Christmas in Blue Dog Valley', '2026-11-21'],
  ['Double Booked for the Holidays', '2026-11-22'],
  ['Christmas Delivered', '2026-11-26'],
  ['Return to Santa', '2026-11-27'],
  ['The Christmas Eve Feast', '2026-11-27'],
  ['Holiday Ever After: A Disney World Wish Come True', '2026-11-28'],
  ['The Most Wonderful Secret', '2026-11-28'],
  ['Eight Nights for Love', '2026-11-29'],
  ['Miles to Christmas', '2026-11-29'],
  ['The Snowflake Effect', '2026-12-04'],
  ['A Grand Biltmore Christmas', '2026-12-05'],
  ['An Angel in My Stocking', '2026-12-06'],
  ['Christmas in Canterbury', '2026-12-11'],
  ['Snow Globe Town', '2026-12-12'],
  ['Noelle Nomads', '2026-12-13'],
  ['Hearts All Aglow', '2026-12-18'],
  ['Barking All the Way', '2026-12-19'],
  ['Save the Date for Christmas', null],
] as const;

type ApprovedMovie = { title: string; premiereDate: string | null };
type Match = { id: number; title: string; releaseDate?: string };
type Pending = ApprovedMovie & {
  brand: 'hallmark';
  reason: string;
  candidates: Match[];
};

const approvedMovies: ApprovedMovie[] = APPROVED_MOVIES.map(([title, premiereDate]) => ({ title, premiereDate }));

function normalise(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function slugify(value: string): string {
  return normalise(value).replace(/\s+/g, '-');
}

function generatedMoviesModule(movies: Movie[]): string {
  return `import { Movie } from '../types';\n\nexport const MOVIES: Movie[] = ${JSON.stringify(movies, null, 2)};\n\nexport function getMovieBySlug(slug: string): Movie | undefined { return MOVIES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()); }\nexport function getMovieByTmdbId(tmdbId: number): Movie | undefined { return MOVIES.find((m) => m.tmdbId === tmdbId); }\nexport function getMovieByTmdbIdAndSlug(tmdbId: number, slug?: string): Movie | undefined { return getMovieByTmdbId(tmdbId) || (slug ? getMovieBySlug(slug) : undefined); }\nexport function getMovieByIdentifier(identifier: string | number): Movie | undefined { const value = String(identifier).trim(); return /^\\d+$/.test(value) ? getMovieByTmdbId(Number(value)) || getMovieBySlug(value) : getMovieBySlug(value); }\nexport function getMoviesByBrand(brandId: string): Movie[] { return MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase()); }\nexport function getMoviesByActorSlug(actorSlug: string): Movie[] { return MOVIES.filter((m) => m.cast.some((c) => c.slug.toLowerCase() === actorSlug.toLowerCase())); }\nexport function getAllYearsForBrand(brandId?: string): number[] { const filtered = brandId ? getMoviesByBrand(brandId) : MOVIES; return Array.from(new Set(filtered.map((m) => m.year))).sort((a, b) => b - a); }\n`;
}

async function resolveMovie(approved: ApprovedMovie, apiKey: string): Promise<{ match?: Match; candidates: Match[]; reason?: string }> {
  const withYear = await searchTmdbMovies(approved.title, 2026, apiKey);
  const withoutYear = withYear.length ? [] : await searchTmdbMovies(approved.title, undefined, apiKey);
  const candidates = [...new Map([...withYear, ...withoutYear].map((match) => [match.id, match])).values()];
  const exact = candidates.filter((match) => normalise(match.title) === normalise(approved.title));
  if (exact.length === 0) return { candidates, reason: 'No exact TMDB title match.' };
  if (approved.premiereDate === null) {
    if (exact.length === 1) return { match: exact[0], candidates };
    return { candidates, reason: 'Multiple exact TMDB title matches; release identity is ambiguous.' };
  }
  const currentYear = exact.filter((match) => !match.releaseDate || match.releaseDate.startsWith('2026'));
  if (currentYear.length === 1) return { match: currentYear[0], candidates };
  return { candidates, reason: currentYear.length > 1 ? 'Multiple exact 2026 TMDB matches.' : 'Exact title did not resolve to a unique 2026 TMDB movie.' };
}

async function main() {
  const apiKey = requireTmdbApiKey();
  const pending: Pending[] = [];
  const collisions: Array<{ title: string; tmdbId: number; existingBrand: string }> = [];
  const resolved: Array<ApprovedMovie & { tmdbId: number; tmdbTitle: string }> = [];

  for (const approved of approvedMovies) {
    const result = await resolveMovie(approved, apiKey);
    if (!result.match) {
      pending.push({ ...approved, brand: 'hallmark', reason: result.reason || 'TMDB identity could not be resolved.', candidates: result.candidates });
      continue;
    }
    const existing = MOVIES.find((movie) => movie.tmdbId === result.match!.id);
    if (existing && existing.brandId !== 'hallmark') {
      collisions.push({ title: approved.title, tmdbId: result.match.id, existingBrand: existing.brandId });
      pending.push({ ...approved, brand: 'hallmark', reason: `TMDB ID already belongs to ${existing.brandId} in XmasDB.`, candidates: result.candidates });
      continue;
    }
    resolved.push({ ...approved, tmdbId: result.match.id, tmdbTitle: result.match.title });
  }

  await writeFileAtomically(PENDING_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), pending, collisions }, null, 2));
  if (process.argv.includes('--resolve-only')) {
    console.log(JSON.stringify({ supplied: approvedMovies.length, resolved: resolved.length, resolvedMovies: resolved, pending, collisions }, null, 2));
    return;
  }

  const existingById = new Map(MOVIES.map((movie) => [movie.tmdbId, movie]));
  const changedMovies: Movie[] = [];
  let newlyImported = 0;
  let alreadyExisted = 0;
  let updatedExisting = 0;

  for (const approved of resolved) {
    const existing = existingById.get(approved.tmdbId);
    const metadata = await fetchTmdbMovie(approved.tmdbId, apiKey);
    if (!metadata?.title || !metadata.cast) {
      pending.push({ title: approved.title, premiereDate: approved.premiereDate, brand: 'hallmark', reason: 'TMDB details were incomplete after identity resolution.', candidates: [{ id: approved.tmdbId, title: approved.tmdbTitle }] });
      continue;
    }
    const posterUrl = await cacheLocalImage(metadata.posterUrl, `/images/posters/${approved.tmdbId}.jpg`);
    const backdropUrl = await cacheLocalImage(metadata.backdropUrl, `/images/backdrops/${approved.tmdbId}.jpg`);
    const movie: Movie = {
      ...existing,
      id: existing?.id || `hallmark-2026-${slugify(metadata.title)}`,
      slug: existing?.slug || slugify(metadata.title),
      title: metadata.title,
      year: 2026,
      brandId: 'hallmark',
      releaseDate: approved.premiereDate || '',
      premiereDate: approved.premiereDate || undefined,
      runtimeMinutes: metadata.runtimeMinutes,
      synopsis: metadata.synopsis || '',
      posterUrl: posterUrl || existing?.posterUrl || '',
      backdropUrl: backdropUrl || existing?.backdropUrl,
      cast: metadata.cast,
      director: metadata.director,
      tmdbId: approved.tmdbId,
      imdbId: metadata.imdbId || existing?.imdbId,
      trailers: metadata.trailers,
      trailerYoutubeKey: metadata.trailerYoutubeKey,
      originalTitle: metadata.originalTitle,
      tagline: metadata.tagline,
      genres: metadata.genres,
      releaseDates: metadata.releaseDates,
      crew: metadata.crew,
      voteAverage: metadata.voteAverage,
      voteCount: metadata.voteCount,
      status: 'coming-soon',
      isComingSoon: true,
      links: {
        tmdb: `https://www.themoviedb.org/movie/${approved.tmdbId}`,
        imdb: metadata.imdbId ? `https://www.imdb.com/title/${metadata.imdbId}/` : existing?.links?.imdb,
      },
    };
    if (existing) {
      alreadyExisted++;
      if (existing.premiereDate !== movie.premiereDate || existing.releaseDate !== movie.releaseDate || existing.status !== movie.status || existing.brandId !== movie.brandId) updatedExisting++;
    } else {
      newlyImported++;
    }
    changedMovies.push(movie);
    existingById.set(movie.tmdbId, movie);
  }

  const changedById = new Map(changedMovies.map((movie) => [movie.tmdbId, movie]));
  const finalMovies = MOVIES.map((movie) => changedById.get(movie.tmdbId) || movie)
    .concat(changedMovies.filter((movie) => !MOVIES.some((existing) => existing.tmdbId === movie.tmdbId)));
  await writeFileAtomically(MOVIES_PATH, generatedMoviesModule(finalMovies));
  const people = await enrichCataloguePeople(changedMovies, apiKey);
  const actorsById = new Map(people.actors.map((actor) => [actor.tmdbPersonId, actor]));
  const enrichedMovies = finalMovies.map((movie) => ({
    ...movie,
    cast: movie.cast.map((cast) => {
      const actor = cast.tmdbPersonId ? actorsById.get(cast.tmdbPersonId) : undefined;
      return actor ? {
        ...cast,
        profileUrl: actor.profileUrl || actor.photoUrl || cast.profileUrl,
        birthday: actor.birthday || cast.birthday,
        deathday: actor.deathday || cast.deathday,
      } : cast;
    }),
  }));
  await writeFileAtomically(MOVIES_PATH, generatedMoviesModule(enrichedMovies));
  await writeFileAtomically(PENDING_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), pending, collisions }, null, 2));
  const report = {
    generatedAt: new Date().toISOString(),
    supplied: approvedMovies.length,
    successfullyResolved: resolved.length - (resolved.length - changedMovies.length),
    newlyImported,
    alreadyExisted,
    updatedExisting,
    stillPending: pending.length,
    brandCollisions: collisions.length,
    actorEnrichment: people,
    pending,
    collisions,
  };
  await writeFileAtomically(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`[Hallmark 2026 Import] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
