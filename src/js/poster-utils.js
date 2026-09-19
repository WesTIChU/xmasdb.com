const UPCOMING_POSTER = '/images/upcoming-placeholder.webp';
export const CARD_GENERIC_POSTER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%23e5e5e5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%23888888">No Poster</text></svg>';
export const DETAIL_GENERIC_POSTER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%23e5e5e5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%23888888">No Poster Available</text></svg>';

export function getPosterFallback(movie, isUpcoming = false, genericPoster = CARD_GENERIC_POSTER) {
  const status = String(movie?.status || '').toLowerCase();
  return isUpcoming || status === 'upcoming' || status === 'coming-soon' ? UPCOMING_POSTER : genericPoster;
}
