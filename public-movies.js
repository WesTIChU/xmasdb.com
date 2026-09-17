/**
 * Public XmasDB titles: collection plus approved Coming Soon records.
 * Collection records are inserted first so they win duplicate TMDB IDs.
 */
export function getPublicMovies(collectionMovies = [], comingSoonMovies = []) {
  const byTmdbId = new Map();
  const collectionSet = new Set(collectionMovies);
  for (const movie of [...collectionMovies, ...comingSoonMovies]) {
    const id = String(movie?.tmdbId || movie?.tmdb_id || '');
    if (!id || byTmdbId.has(id)) continue;
    byTmdbId.set(id, {
      ...movie,
      status: collectionSet.has(movie) ? 'collection' : 'upcoming'
    });
  }
  return [...byTmdbId.values()];
}
