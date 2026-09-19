import 'dotenv/config';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MOVIES } from '../src/data/movies';
import { BRANDS } from '../src/data/brands';
import { Movie } from '../src/types';
import { writeFileAtomically } from '../src/utils/atomic-file';

const moviesPath = path.join(process.cwd(), 'src/data/movies.ts');
const execFileAsync = promisify(execFile);

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function generatedMoviesModule(movies: Movie[]): string {
  return `import { Movie } from '../types';\n\nexport const MOVIES: Movie[] = ${JSON.stringify(movies, null, 2)};\n\nexport function getMovieBySlug(slug: string): Movie | undefined { return MOVIES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()); }\nexport function getMovieByTmdbId(tmdbId: number): Movie | undefined { return MOVIES.find((m) => m.tmdbId === tmdbId); }\nexport function getMovieByTmdbIdAndSlug(tmdbId: number, slug?: string): Movie | undefined { return getMovieByTmdbId(tmdbId) || (slug ? getMovieBySlug(slug) : undefined); }\nexport function getMovieByIdentifier(identifier: string | number): Movie | undefined { const value = String(identifier).trim(); return /^\\d+$/.test(value) ? getMovieByTmdbId(Number(value)) || getMovieBySlug(value) : getMovieBySlug(value); }\nexport function getMoviesByBrand(brandId: string): Movie[] { return MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase()); }\nexport function getMoviesByActorSlug(actorSlug: string): Movie[] { return MOVIES.filter((m) => m.cast.some((c) => c.slug.toLowerCase() === actorSlug.toLowerCase())); }\nexport function getAllYearsForBrand(brandId?: string): number[] { const filtered = brandId ? getMoviesByBrand(brandId) : MOVIES; return Array.from(new Set(filtered.map((m) => m.year))).sort((a, b) => b - a); }\n`;
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

  const today = new Date().toISOString().slice(0, 10);
  const movie: Movie = {
    id: `${brandId}-${tmdbId}`,
    slug,
    title: `TMDB movie ${tmdbId}`,
    year: new Date().getUTCFullYear(),
    brandId,
    releaseDate: today,
    synopsis: '',
    posterUrl: '',
    cast: [],
    tmdbId,
    status,
    isComingSoon: status === 'coming-soon',
  };
  await writeFileAtomically(moviesPath, generatedMoviesModule([...MOVIES, movie]));
  console.log(`Added local catalogue movie ${tmdbId} as ${brandId}; fetching TMDB metadata immediately.`);
  await execFileAsync('npm', ['run', 'refresh:tmdb', '--', '--tmdb-id', String(tmdbId)], { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 });
}

main().catch((error) => {
  console.error(`[Add Movie] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
