import 'dotenv/config';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { generateMoviesModule } from '../src/server/movie-import';
import { OpenRouterJevKeywordClassifier } from '../src/server/jev-keywords';
import { JEV_KEYWORD_CHECKPOINT_PATH } from '../src/server/jev-keyword-refresh';
import { runJevKeywordCatalogue } from '../src/server/jev-keyword-catalogue';
import { writeFileAtomically } from '../src/utils/atomic-file';

const moviesPath = path.join(process.cwd(), 'src/data/movies.ts');
const classifier = new OpenRouterJevKeywordClassifier();
const result = await runJevKeywordCatalogue({
  movies: MOVIES,
  classifier,
  checkpointPath: JEV_KEYWORD_CHECKPOINT_PATH,
  writeMovies: (movies) => writeFileAtomically(moviesPath, generateMoviesModule(movies)),
  onFailure: (failure) => console.error(`[Jev Keywords] Failed ${failure.tmdbId}: ${failure.message}`),
});

console.log(`[Jev Keywords] Classified: ${result.classified}; skipped: ${result.skipped}; failures: ${result.failures.length}; catalogue changed: ${result.changed}`);
