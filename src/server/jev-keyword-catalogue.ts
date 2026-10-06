import type { Movie } from '../types';
import type { JevKeywordClassifier } from './jev-keywords';
import { runJevKeywordRefresh, type JevKeywordRefreshFailure } from './jev-keyword-refresh';

export interface JevKeywordCatalogueRunOptions {
  movies: Movie[];
  classifier: JevKeywordClassifier;
  checkpointPath?: string;
  writeMovies?: (movies: Movie[]) => Promise<void>;
  onFailure?: (failure: JevKeywordRefreshFailure) => void;
}

export interface JevKeywordCatalogueRunResult {
  movies: Movie[];
  changed: boolean;
  classified: number;
  skipped: number;
  failures: JevKeywordRefreshFailure[];
}

export async function runJevKeywordCatalogue(options: JevKeywordCatalogueRunOptions): Promise<JevKeywordCatalogueRunResult> {
  const nextMovies: Movie[] = [];
  const failures: JevKeywordRefreshFailure[] = [];
  let classified = 0;
  let skipped = 0;
  for (const movie of options.movies) {
    const result = await runJevKeywordRefresh(movie, {
      classifier: options.classifier,
      checkpointPath: options.checkpointPath,
    });
    if (result.skipped) skipped += 1;
    else if (result.failure) {
      failures.push(result.failure);
      options.onFailure?.(result.failure);
    } else classified += 1;
    nextMovies.push(result.movie);
  }
  const changed = nextMovies.some((movie, index) => JSON.stringify(movie) !== JSON.stringify(options.movies[index]));
  if (changed && options.writeMovies) await options.writeMovies(nextMovies);
  return { movies: nextMovies, changed, classified, skipped, failures };
}
