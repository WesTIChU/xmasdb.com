/**
 * Utility functions for Actor metadata and dynamic age calculations.
 */

export const PLACEHOLDER_ACTOR_PHOTO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="185" height="240" viewBox="0 0 185 240"><rect width="185" height="240" fill="%23e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%239ca3af">No Photo</text></svg>';

/**
 * Constructs a valid actor profile image URL.
 * Handles TMDB relative paths (/abc123.jpg), full http/https URLs, and filters out null/undefined/[object Object].
 * Returns fallback placeholder if no valid profile image.
 */
export function getActorProfileImageUrl(rawPath, size = 'w185') {
  if (!rawPath || typeof rawPath !== 'string') {
    return PLACEHOLDER_ACTOR_PHOTO;
  }

  const clean = rawPath.trim();
  if (
    !clean ||
    clean === 'null' ||
    clean === 'undefined' ||
    clean === '[object Object]' ||
    clean.includes('undefined') ||
    clean.includes('null') ||
    clean.includes('[object')
  ) {
    return PLACEHOLDER_ACTOR_PHOTO;
  }

  if (clean.startsWith('/images/')) return clean;

  // External TMDB paths are ingestion-only and must never be requested by the site.
  return clean.startsWith('data:') ? clean : PLACEHOLDER_ACTOR_PHOTO;
}

export function calculateActorAge(birthday, deathday = null) {
  if (!birthday) return null;
  const birth = new Date(birthday);
  if (isNaN(birth.getTime())) return null;

  // Use date of death if deceased, or current date if living
  const refDate = deathday ? new Date(deathday) : new Date();
  if (isNaN(refDate.getTime())) return null;

  let age = refDate.getFullYear() - birth.getFullYear();
  const monthDiff = refDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < birth.getDate())) {
    age--;
  }

  const options = { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
  const birthdayStr = birth.toLocaleDateString('en-US', options);
  const deathdayStr = deathday ? new Date(deathday).toLocaleDateString('en-US', options) : null;

  return {
    age,
    isDeceased: Boolean(deathday),
    birthdayStr,
    deathdayStr
  };
}

/**
 * Returns formatted subtitle for cast cards, e.g.:
 * "Ashley · Age 38" or "Bill Mitchell · Aged 71" or just "Ashley"
 */
export function formatCastCardSubtitle(character, birthday, deathday = null) {
  const ageInfo = calculateActorAge(birthday, deathday);
  const charText = (character || '').trim();

  if (!ageInfo) {
    return charText;
  }

  const ageText = ageInfo.isDeceased ? `Aged ${ageInfo.age}` : `Age ${ageInfo.age}`;

  if (charText) {
    return `${charText} · ${ageText}`;
  }
  return ageText;
}

/**
 * Normalizes text for search matching:
 * Lowercase, trimmed, converts "&" to "and", removes punctuation, collapses whitespace.
 */
export function normalizeSearchText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
