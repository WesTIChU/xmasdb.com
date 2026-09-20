import 'dotenv/config';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MOVIES } from '../src/data/movies';
import { BRANDS } from '../src/data/brands';
import { writeFileAtomically } from '../src/utils/atomic-file';
import { buildMovieFromTmdb, generateMoviesModule, type MovieBrand, type MovieStatus } from '../src/server/movie-import';

const moviesPath = path.join(process.cwd(), 'src/data/movies.ts');
const execFileAsync = promisify(execFile);

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const tmdbId = Number(option('--tmdb-id'));
  const brandId = option('--brand')?.toLowerCase();
  const status = option('--status') || 'collection';
  const slug = option('--slug') || `tmdb-${tmdbId}`;
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new Error('Use --tmdb-id with a positive TMDB movie ID.');
  if (!brandId || !BRANDS.some((brand) => brand.id === brandId)) throw new Error('Use --brand with an ID from the central brand configuration.');
  if (!['collection', 'coming-soon'].includes(status)) throw new Error('--status must be collection or coming-soon.');
  if (MOVIES.some((movie) => movie.tmdbId === tmdbId)) throw new Error(`Movie ${tmdbId} is already in the local catalogue.`);

  const movie = buildMovieFromTmdb(tmdbId, { title: `TMDB movie ${tmdbId}` }, brandId as MovieBrand, status as MovieStatus);
  if (slug !== `tmdb-${tmdbId}`) movie.slug = slug;
  await writeFileAtomically(moviesPath, generateMoviesModule([...MOVIES, movie]));
  console.log(`Added local catalogue movie ${tmdbId} as ${brandId}; fetching TMDB metadata immediately.`);
  await execFileAsync('npm', ['run', 'refresh:tmdb', '--', '--tmdb-id', String(tmdbId)], { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 });
}

main().catch((error) => {
  console.error(`[Add Movie] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
