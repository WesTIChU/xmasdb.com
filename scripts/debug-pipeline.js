import { inspectMovieCast, rebuildAllCastFromTmdb } from './enrich-cast.js';

const run = process.argv.includes('--rebuild') ? rebuildAllCastFromTmdb : inspectMovieCast;
run({}).catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
