function movieId(movie) {
  return Number(movie.tmdbId || movie.tmdb_id);
}

export function getRefreshTargets(movies, upcoming, { scope = 'all', requestedIds = null } = {}) {
  const targets = [
    ...(scope === 'coming-soon' ? [] : movies.map(movie => ({ collection: true, list: movies, movie }))),
    ...(scope === 'collection' ? [] : upcoming.map(movie => ({ collection: false, list: upcoming, movie })))
  ];
  return targets.filter(({ movie }) => !requestedIds || requestedIds.has(movieId(movie)));
}
