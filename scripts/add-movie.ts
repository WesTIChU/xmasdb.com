import 'dotenv/config';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { MOVIES } from '../src/data/movies';
import { BRANDS } from '../src/data/brands';
import { writeFileAtomically } from '../src/utils/atomic-file';
import { buildMovieFromTmdb, generateMoviesModule, type MovieBrand, type MovieStatus } from '../src/server/movie-import';
import { ingestManagedImage } from '../src/server/managed-images';
import type { Movie } from '../src/types';
import { fetchTmdbMovie, requireTmdbApiKey } from '../src/utils/tmdb';

const moviesPath = path.join(process.cwd(), 'src/data/movies.ts');
const execFileAsync = promisify(execFile);

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export async function prepareManagedArtwork(tmdbId: number, metadata: Partial<Movie>, ingest = ingestManagedImage): Promise<Partial<Movie>> {
  const artwork: Partial<Movie> = { ...metadata, posterUrl: undefined, backdropUrl: undefined };
  if (metadata.posterUrl) {
    try {
      artwork.posterUrl = await ingest(metadata.posterUrl, `/images/posters/${tmdbId}.jpg`);
    } catch (error) {
      console.error(`[Add Movie] Poster publication failed for ${tmdbId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (metadata.backdropUrl) {
    try {
      artwork.backdropUrl = await ingest(metadata.backdropUrl, `/images/backdrops/${tmdbId}.jpg`);
    } catch (error) {
      console.error(`[Add Movie] Backdrop publication failed for ${tmdbId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return artwork;
}

export async function addMovie(options: {
  tmdbId: number;
  brandId: MovieBrand;
  status: MovieStatus;
  slug?: string;
  movies?: Movie[];
  fetchMovie?: typeof fetchTmdbMovie;
  apiKey?: string;
  ingest?: typeof ingestManagedImage;
  writeMovies?: (movies: Movie[]) => Promise<void>;
  refresh?: () => Promise<void>;
}): Promise<Movie> {
  const movies = options.movies || MOVIES;
  if (movies.some((movie) => movie.tmdbId === options.tmdbId)) throw new Error(`Movie ${options.tmdbId} is already in the local catalogue.`);
  const metadata = await (options.fetchMovie || fetchTmdbMovie)(options.tmdbId, options.apiKey || requireTmdbApiKey());
  if (!metadata) throw new Error(`TMDB returned no movie data for ${options.tmdbId}.`);
  const managedMetadata = await prepareManagedArtwork(options.tmdbId, metadata, options.ingest);
  const movie = buildMovieFromTmdb(options.tmdbId, managedMetadata, options.brandId, options.status);
  if (options.slug && options.slug !== `tmdb-${options.tmdbId}`) movie.slug = options.slug;
  await (options.writeMovies || (async (nextMovies) => writeFileAtomically(moviesPath, generateMoviesModule(nextMovies))))([...movies, movie]);
  if (options.refresh) await options.refresh();
  return movie;
}

async function main() {
  const tmdbId = Number(option('--tmdb-id'));
  const brandId = option('--brand')?.toLowerCase();
  const status = option('--status') || 'collection';
  const slug = option('--slug') || `tmdb-${tmdbId}`;
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new Error('Use --tmdb-id with a positive TMDB movie ID.');
  if (!brandId || !BRANDS.some((brand) => brand.id === brandId)) throw new Error('Use --brand with an ID from the central brand configuration.');
  if (!['collection', 'coming-soon'].includes(status)) throw new Error('--status must be collection or coming-soon.');
  await addMovie({
    tmdbId,
    brandId: brandId as MovieBrand,
    status: status as MovieStatus,
    slug,
    refresh: async () => { await execFileAsync('npm', ['run', 'refresh:tmdb', '--', '--tmdb-id', String(tmdbId)], { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }); },
  });
  console.log(`Added local catalogue movie ${tmdbId} as ${brandId}; fetching TMDB metadata immediately.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[Add Movie] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
