import { ensureCachedImage } from './local-assets.js';
import { fetchTmdbPerson, normalizeProfilePath } from './enrich-cast.js';

export async function enrichMovieCast(rawCast, { token, personCache, rootDir, forceRefresh = false, imageEnsurer = ensureCachedImage }) {
  const enrichedCast = [];
  const imageCache = new Map();

  for (const credit of Array.isArray(rawCast) ? rawCast : []) {
    if (!credit?.id || !credit.name) continue;
    let person = null;
    try {
      person = await fetchTmdbPerson(credit.id, token, personCache, forceRefresh);
    } catch {
      // Keep the TMDB credit even if person enrichment is unavailable.
    }

    if (!imageCache.has(Number(credit.id))) {
      const image = await imageEnsurer({
        kind: 'person',
        id: credit.id,
        filePath: person?.profile_path || credit.profile_path,
        rootDir
      });
      imageCache.set(Number(credit.id), image);
      if (person && image.path) {
        person.profile_path = image.path;
        person.profile = image.path;
      }
    }

    const image = imageCache.get(Number(credit.id));
    enrichedCast.push({
      id: credit.id,
      name: person?.name || credit.name,
      character: credit.character || '',
      order: credit.order,
      profile_path: image?.path || normalizeProfilePath(person?.profile_path) || normalizeProfilePath(credit.profile_path),
      birthday: person?.birthday || credit.birthday || null,
      deathday: person?.deathday || credit.deathday || null
    });
  }
  return enrichedCast;
}
