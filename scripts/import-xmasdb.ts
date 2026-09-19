import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { Actor, CastMember, CrewMember, Movie, ReleaseDateInfo, Trailer } from '../src/types';
import { fetchTmdbMovie, fetchTmdbPerson } from '../src/utils/tmdb';
import { reconcileMovieLifecycle } from '../src/utils/catalogue-lifecycle';
import { writeFileAtomically } from '../src/utils/atomic-file';

const SOURCE_URL = 'https://xmasdb.com/movies.json';
const SOURCE_ORIGIN = 'https://xmasdb.com';
const moviesPath = path.join(process.cwd(), 'src/data/movies.ts');
const actorsPath = path.join(process.cwd(), 'src/data/actors.json');
const publicPath = path.join(process.cwd(), 'public');

interface SourceGenre { id?: number; name?: string; }
interface SourceReleaseDate { country?: string; release_date?: string; type?: number; certification?: string; note?: string; }
interface SourceCrew { id?: number; name?: string; job?: string; credit_id?: string; }
interface SourceCast {
  id?: number;
  name?: string;
  character?: string;
  order?: number;
  profile_path?: string | null;
  birthday?: string | null;
  deathday?: string | null;
}
interface SourceVideo { key?: string; site?: string; type?: string; name?: string; official?: boolean; }
interface SourceMovie {
  title?: string;
  year?: number;
  tmdbId?: number;
  tmdb_id?: number;
  imdbId?: string;
  imdb_id?: string;
  poster?: string | null;
  backdrop?: string | null;
  overview?: string;
  originalTitle?: string;
  premiereDate?: string;
  release_date?: string;
  runtime?: number;
  genres?: SourceGenre[];
  videos?: SourceVideo[];
  release_dates?: SourceReleaseDate[];
  crew?: SourceCrew[];
  cast?: SourceCast[];
  status?: string;
  tagline?: string;
  vote_average?: number;
  vote_count?: number;
}

interface ImportReport {
  source: number;
  imported: number;
  updated: number;
  alreadyPresent: number;
  collection: number;
  comingSoon: number;
  actors: number;
  images: number;
  refreshFailures: number;
  failed: number;
}

const report: ImportReport = {
  source: 0,
  imported: 0,
  updated: 0,
  alreadyPresent: 0,
  collection: 0,
  comingSoon: 0,
  actors: 0,
  images: 0,
  refreshFailures: 0,
  failed: 0,
};

const failures: string[] = [];

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function sourceTmdbId(movie: SourceMovie): number | undefined {
  const id = movie.tmdbId ?? movie.tmdb_id;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : undefined;
}

function sourceImdbId(movie: SourceMovie): string | undefined {
  return movie.imdbId || movie.imdb_id || undefined;
}

function localAssetPath(relativePath: string, kind: 'posters' | 'backdrops' | 'people', id: number): string {
  const extension = path.extname(relativePath) || '.webp';
  return `/images/${kind}/${id}${extension}`;
}

async function cacheImage(source: string | null | undefined, destination: string): Promise<boolean> {
  if (!source) return false;
  const destinationPath = path.join(publicPath, destination.replace(/^\//, ''));
  try {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    try {
      await fs.access(destinationPath);
      return true;
    } catch {
      // Download only when the local cache does not already contain the asset.
    }
    const url = source.startsWith('http') ? source : `${SOURCE_ORIGIN}${source.startsWith('/') ? '' : '/'}${source}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await fs.writeFile(destinationPath, Buffer.from(await response.arrayBuffer()));
    report.images++;
    return true;
  } catch (error) {
    failures.push(`Image ${source}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function normalizeCastMember(member: SourceCast, profileUrl?: string): CastMember | null {
  if (!member.id || !member.name) return null;
  return {
    actorId: String(member.id),
    name: member.name,
    character: member.character || '',
    slug: slugify(member.name),
    tmdbPersonId: member.id,
    profileUrl,
    order: member.order,
    birthday: member.birthday || undefined,
    deathday: member.deathday || undefined,
  };
}

function normalizeCrew(crew: SourceCrew[] | undefined): CrewMember[] {
  return (crew || []).filter((member): member is Required<Pick<SourceCrew, 'id' | 'name' | 'job'>> & SourceCrew => Boolean(member.id && member.name && member.job)).map((member) => ({
    id: member.id,
    name: member.name,
    job: member.job,
    creditId: member.credit_id,
  }));
}

function normalizeReleaseDates(releases: SourceReleaseDate[] | undefined): ReleaseDateInfo[] {
  return (releases || []).filter((release): release is Required<Pick<SourceReleaseDate, 'country' | 'release_date'>> & SourceReleaseDate => Boolean(release.country && release.release_date)).map((release) => ({
    country: release.country,
    releaseDate: release.release_date,
    type: release.type,
    certification: release.certification,
    note: release.note,
  }));
}

async function normalizeMovie(source: SourceMovie, existing?: Movie): Promise<Movie> {
  const tmdbId = sourceTmdbId(source);
  if (!tmdbId) throw new Error('missing valid tmdbId/tmdb_id');
  if (!source.title) throw new Error(`movie ${tmdbId} is missing title`);

  const poster = localAssetPath(source.poster || '', 'posters', tmdbId);
  const backdrop = localAssetPath(source.backdrop || '', 'backdrops', tmdbId);
  const posterCached = await cacheImage(source.poster, poster);
  const backdropCached = await cacheImage(source.backdrop, backdrop);
  const status = source.status || existing?.status || 'collection';
  const releaseDate = source.release_date || source.premiereDate || existing?.releaseDate || `${source.year || new Date().getFullYear()}-01-01`;
  const genres = (source.genres || []).filter((genre): genre is Required<SourceGenre> => Boolean(genre.id && genre.name)).map((genre) => ({ id: genre.id, name: genre.name }));
  const trailers: Trailer[] = (source.videos || []).filter((video): video is Required<Pick<SourceVideo, 'key' | 'site' | 'type' | 'name'>> & SourceVideo => Boolean(video.key && video.site && video.type && video.name)).map((video) => ({ key: video.key, site: video.site, type: video.type, name: video.name, official: video.official }));
  const releaseDates = normalizeReleaseDates(source.release_dates);
  const crew = normalizeCrew(source.crew);
  const sourceCast = (source.cast || []).map((member) => normalizeCastMember(member, member.profile_path ? localAssetPath(member.profile_path, 'people', member.id as number) : undefined)).filter((member): member is CastMember => Boolean(member));

  for (const member of source.cast || []) {
    if (member.id && member.profile_path) await cacheImage(member.profile_path, localAssetPath(member.profile_path, 'people', member.id));
  }

  return {
    ...existing,
    id: existing?.id || `hallmark-${source.year || releaseDate.slice(0, 4)}-${slugify(source.title)}`,
    slug: existing?.slug || slugify(source.title),
    title: source.title,
    year: source.year || Number(releaseDate.slice(0, 4)),
    brandId: 'hallmark',
    releaseDate,
    runtimeMinutes: source.runtime || existing?.runtimeMinutes,
    synopsis: source.overview || existing?.synopsis || '',
    posterUrl: posterCached ? poster : '',
    backdropUrl: backdropCached ? backdrop : undefined,
    cast: sourceCast,
    director: crew.find((member) => member.job === 'Director')?.name,
    tmdbId,
    imdbId: sourceImdbId(source),
    isComingSoon: status.toLowerCase() === 'coming-soon',
    trailers,
    trailerYoutubeKey: trailers.find((trailer) => trailer.site === 'YouTube')?.key,
    originalTitle: source.originalTitle,
    tagline: source.tagline,
    premiereDate: source.premiereDate,
    genres,
    releaseDates,
    crew,
    voteAverage: source.vote_average,
    voteCount: source.vote_count,
    status,
    links: {
      imdb: sourceImdbId(source) ? `https://www.imdb.com/title/${sourceImdbId(source)}/` : undefined,
      tmdb: `https://www.themoviedb.org/movie/${tmdbId}`,
    },
  };
}

function applyTmdbMovieRefresh(movie: Movie, refreshed: Partial<Movie>): Movie {
  return {
    ...movie,
    ...refreshed,
    brandId: 'hallmark',
    status: movie.status,
    isComingSoon: movie.isComingSoon,
  };
}

async function readExistingActors(): Promise<Map<number, Actor>> {
  try {
    const parsed = JSON.parse(await fs.readFile(actorsPath, 'utf8')) as Actor[];
    return new Map(parsed.filter((actor) => actor.tmdbPersonId).map((actor) => [actor.tmdbPersonId, actor]));
  } catch {
    return new Map();
  }
}

function generatedMoviesModule(movies: Movie[]): string {
  return `import { Movie } from '../types';\n\nexport const MOVIES: Movie[] = ${JSON.stringify(movies, null, 2)};\n\nexport function getMovieBySlug(slug: string): Movie | undefined { return MOVIES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()); }\nexport function getMovieByTmdbId(tmdbId: number): Movie | undefined { return MOVIES.find((m) => m.tmdbId === tmdbId); }\nexport function getMovieByTmdbIdAndSlug(tmdbId: number, slug?: string): Movie | undefined { return getMovieByTmdbId(tmdbId) || (slug ? getMovieBySlug(slug) : undefined); }\nexport function getMovieByIdentifier(identifier: string | number): Movie | undefined { const value = String(identifier).trim(); return /^\\d+$/.test(value) ? getMovieByTmdbId(Number(value)) || getMovieBySlug(value) : getMovieBySlug(value); }\nexport function getMoviesByBrand(brandId: string): Movie[] { return MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase()); }\nexport function getMoviesByActorSlug(actorSlug: string): Movie[] { return MOVIES.filter((m) => m.cast.some((c) => c.slug.toLowerCase() === actorSlug.toLowerCase())); }\nexport function getAllYearsForBrand(brandId?: string): number[] { const filtered = brandId ? getMoviesByBrand(brandId) : MOVIES; return Array.from(new Set(filtered.map((m) => m.year))).sort((a, b) => b - a); }\n`;
}

async function importCatalogue() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Source download failed: HTTP ${response.status}`);
  const source = await response.json() as unknown;
  if (!Array.isArray(source) || source.length === 0) throw new Error('Source data is not a non-empty movie array');
  report.source = source.length;

  const existingByTmdb = new Map(MOVIES.map((movie) => [movie.tmdbId, movie]));
  const importedMovies = new Map<number, Movie>();
  for (const rawMovie of source as SourceMovie[]) {
    try {
      const tmdbId = sourceTmdbId(rawMovie);
      if (!tmdbId) throw new Error('missing valid TMDB ID');
      const existing = existingByTmdb.get(tmdbId);
      let movie = reconcileMovieLifecycle(await normalizeMovie(rawMovie, existing));
      if (process.env.TMDB_API_KEY) {
        const refreshed = await fetchTmdbMovie(tmdbId, process.env.TMDB_API_KEY);
        if (refreshed) {
          movie = reconcileMovieLifecycle(applyTmdbMovieRefresh(movie, refreshed));
          if (refreshed.posterUrl) {
            const cached = localAssetPath(rawMovie.poster || '', 'posters', tmdbId);
            if (await cacheImage(refreshed.posterUrl, cached)) movie.posterUrl = cached;
          }
          if (refreshed.backdropUrl) {
            const cached = localAssetPath(rawMovie.backdrop || '', 'backdrops', tmdbId);
            if (await cacheImage(refreshed.backdropUrl, cached)) movie.backdropUrl = cached;
          }
        } else {
          report.refreshFailures++;
        }
      }
      importedMovies.set(tmdbId, movie);
      if (existing) report.updated++;
      else report.imported++;
      if (statusIsComingSoon(movie.status)) report.comingSoon++;
      else report.collection++;
    } catch (error) {
      report.failed++;
      failures.push(`Movie ${rawMovie.title || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const mergedMovies = [...MOVIES.filter((movie) => !importedMovies.has(movie.tmdbId)), ...importedMovies.values()];
  report.alreadyPresent = report.source - report.imported - report.updated - report.failed;
  await writeFileAtomically(moviesPath, generatedMoviesModule(mergedMovies));

  const actorsById = await readExistingActors();
  for (const movie of importedMovies.values()) {
    for (const cast of movie.cast) {
      if (!cast.tmdbPersonId) continue;
      const existing = actorsById.get(cast.tmdbPersonId);
      let actor: Actor = {
        ...existing,
        id: existing?.id || cast.slug,
        slug: existing?.slug || cast.slug,
        name: existing?.name || cast.name,
        tmdbPersonId: cast.tmdbPersonId,
        photoUrl: existing?.photoUrl || cast.profileUrl,
        profileUrl: existing?.profileUrl || cast.profileUrl,
        birthday: existing?.birthday || cast.birthday,
        deathday: existing?.deathday || cast.deathday,
      };
      if (process.env.TMDB_API_KEY) {
        const refreshed = await fetchTmdbPerson(cast.tmdbPersonId, process.env.TMDB_API_KEY);
        if (refreshed) {
          const profile = refreshed.profileUrl ? localAssetPath(refreshed.profileUrl, 'people', cast.tmdbPersonId) : undefined;
          if (refreshed.profileUrl && profile) await cacheImage(refreshed.profileUrl, profile);
          actor = { ...actor, ...refreshed, photoUrl: profile || actor.photoUrl, profileUrl: profile || actor.profileUrl, id: actor.id, slug: actor.slug, tmdbPersonId: cast.tmdbPersonId };
        } else {
          report.refreshFailures++;
        }
      }
      actorsById.set(cast.tmdbPersonId, actor);
    }
  }
  report.actors = actorsById.size;
  await writeFileAtomically(actorsPath, JSON.stringify([...actorsById.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2));

  console.log(`Source movies: ${report.source}`);
  console.log(`Imported: ${report.imported}`);
  console.log(`Updated: ${report.updated}`);
  console.log(`Already present: ${report.alreadyPresent}`);
  console.log(`Collection: ${report.collection}`);
  console.log(`Coming Soon: ${report.comingSoon}`);
  console.log(`Actors discovered: ${report.actors}`);
  console.log(`Images migrated/downloaded: ${report.images}`);
  console.log(`TMDB refresh failures: ${report.refreshFailures}`);
  console.log(`Failed: ${report.failed}`);
  if (failures.length > 0) {
    console.error('\nIndividual failures:');
    failures.forEach((failure) => console.error(`- ${failure}`));
  }
}

function statusIsComingSoon(status?: string): boolean {
  return status?.toLowerCase() === 'coming-soon';
}

importCatalogue().catch((error) => {
  console.error(`[XmasDB Import] Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
