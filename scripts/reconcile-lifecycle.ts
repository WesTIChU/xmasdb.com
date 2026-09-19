import 'dotenv/config';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { Movie } from '../src/types';
import { reconcileMovieLifecycle } from '../src/utils/catalogue-lifecycle';
import { writeFileAtomically } from '../src/utils/atomic-file';

const moviesPath = path.join(process.cwd(), 'src/data/movies.ts');

function generatedMoviesModule(movies: Movie[]): string {
  return `import { Movie } from '../types';\n\nexport const MOVIES: Movie[] = ${JSON.stringify(movies, null, 2)};\n\nexport function getMovieBySlug(slug: string): Movie | undefined { return MOVIES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()); }\nexport function getMovieByTmdbId(tmdbId: number): Movie | undefined { return MOVIES.find((m) => m.tmdbId === tmdbId); }\nexport function getMovieByTmdbIdAndSlug(tmdbId: number, slug?: string): Movie | undefined { return getMovieByTmdbId(tmdbId) || (slug ? getMovieBySlug(slug) : undefined); }\nexport function getMovieByIdentifier(identifier: string | number): Movie | undefined { const value = String(identifier).trim(); return /^\\d+$/.test(value) ? getMovieByTmdbId(Number(value)) || getMovieBySlug(value) : getMovieBySlug(value); }\nexport function getMoviesByBrand(brandId: string): Movie[] { return MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase()); }\nexport function getMoviesByActorSlug(actorSlug: string): Movie[] { return MOVIES.filter((m) => m.cast.some((c) => c.slug.toLowerCase() === actorSlug.toLowerCase())); }\nexport function getAllYearsForBrand(brandId?: string): number[] { const filtered = brandId ? getMoviesByBrand(brandId) : MOVIES; return Array.from(new Set(filtered.map((m) => m.year))).sort((a, b) => b - a); }\n`;
}

async function main() {
  const reconciled = MOVIES.map((movie) => reconcileMovieLifecycle(movie));
  const promoted = reconciled.filter((movie, index) => movie.status !== MOVIES[index].status);
  if (promoted.length > 0) await writeFileAtomically(moviesPath, generatedMoviesModule(reconciled));
  console.log(`Lifecycle reconciliation: ${promoted.length} movie(s) promoted to collection.`);
}

main().catch((error) => {
  console.error(`[Lifecycle] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
