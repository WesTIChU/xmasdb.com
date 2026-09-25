export const TMDB_FRESHNESS_MONTHS = 5;
export const TMDB_MIGRATION_BATCH_SIZE = 100;

export function tmdbFreshnessCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - TMDB_FRESHNESS_MONTHS);
  return cutoff;
}

export function isTmdbFresh(timestamp: string | undefined, now: Date = new Date()): boolean {
  if (!timestamp) return false;
  const fetchedAt = Date.parse(timestamp);
  return Number.isFinite(fetchedAt) && fetchedAt >= tmdbFreshnessCutoff(now).getTime();
}

export function timestampAgeDays(timestamp: string | undefined, now: Date = new Date()): number | undefined {
  if (!timestamp) return undefined;
  const fetchedAt = Date.parse(timestamp);
  if (!Number.isFinite(fetchedAt)) return undefined;
  return Math.max(0, Math.floor((now.getTime() - fetchedAt) / 86_400_000));
}
