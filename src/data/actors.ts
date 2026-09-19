import { Actor } from '../types';
import { MOVIES } from './movies';
import ACTORS_DATA from './actors.json';

// Master TMDB Person ID lookup dictionary
export const ACTOR_TMDB_LOOKUP: Record<string, number> = {
  'lacey-chabert': 15309,
  'tyler-hynes': 83286,
  'bethany-joy-lenz': 35051,
  'andrew-walker': 68478,
  'paul-campbell': 62909,
  'kristoffer-polaha': 58211,
  'hunter-king': 1237691,
  'jane-seymour': 1546,
  'tia-mowry': 77093,
  'melissa-joan-hart': 49925,
  'jana-kramer': 211517,
  'ben-lewis': 1253457,
  'kelly-rowland': 11218,
  'marilu-henner': 41604,
  'treat-williams': 12519,
  'margaret-colin': 14833,
  'ed-begley-jr': 21731,
  'ashley-newbrough': 1221773,
  'travis-van-winkle': 54930,
  'erin-krakow': 1279261,
  'daniel-lissing': 1113038,
  'benjamin-ayres': 1218768,
  'jonathan-frakes': 947,
  'benjamin-hollingsworth': 1045731,
  'amy-groening': 1475753,
  'vic-michaelis': 2269985,
  'bryan-greenberg': 55431,
  'rick-hoffman': 109579,
  'scott-wolf': 60233,
  'fiona-bell': 212557,
  'italia-ricci': 85278,
  'luke-macfarlane': 64998,
  'wes-brown': 205820,
  'stephen-tobolowsky': 4581,
  'melissa-peterman': 54848,
  'kim-matula': 214534,
  'ian-harding': 200508,
  'reginald-veljohnson': 60462,
  'alison-wandzura': 1425114,
  'lyndsy-fonseca': 63519,
  'chandler-massey': 1238472,
  'christopher-lloyd': 1062,
  'lea-thompson': 1063,
  'robert-buckley': 78996,
  'jonathan-bennett': 21422,
  'sharon-lawrence': 75783,
  'danica-mckellar': 60234,
  'rupert-penry-jones': 11210,
  'ellie-botterill': 1813137,
  'stephen-hagan': 1033282,
  'ryan-paevey': 1313437,
  'mario-lopez': 78374,
  'jessica-lord': 1978250,
  'laith-wallschleger': 2470197,
  'jeannie-mai': 1422709,
  'ronreaco-lee': 66531,
  'donna-biscoe': 71206,
  'loni-anderson': 80894,
  'morgan-fairchild': 41602,
  'linda-gray': 35052,
  'donna-mills': 41603,
  'nicollette-sheridan': 26085,
  'adam-senn': 1243760,
  'max-ehrich': 200511,
  'mark-taylor': 118432,
  'joe-lando': 64999,
  'keshia-knight-pulliam': 77094,
  'brad-james': 1253456,
  'patti-labelle': 84360,
  'mary-antonini': 2269986,
  'michael-xavier': 1445763,
  'blake-lee': 1243764,
  'fran-drescher': 19888,
  'ellen-wong': 108316,
  'jason-priestley': 21421,
  'thomas-cadrot': 1729864,
  'bresha-webb': 1432474,
};

// Deterministic fallback generator if an unknown slug ever appears
export function getTmdbPersonIdForSlug(slug: string): number {
  const clean = slug.toLowerCase().trim();
  if (ACTOR_TMDB_LOOKUP[clean]) {
    return ACTOR_TMDB_LOOKUP[clean];
  }
  // Generate stable 6-digit positive integer hash
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  return 100000 + Math.abs(hash % 900000);
}

export const ACTORS: Actor[] = (ACTORS_DATA as Actor[]).map((a) => ({
  ...a,
  photoUrl: a.profileUrl || a.photoUrl,
}));

// Populate ACTOR_TMDB_LOOKUP with all loaded actors
for (const a of ACTORS) {
  if (a.slug && a.tmdbPersonId) {
    ACTOR_TMDB_LOOKUP[a.slug.toLowerCase().trim()] = a.tmdbPersonId;
  }
}

export function getActorBySlug(slug: string): Actor | undefined {
  const clean = slug.toLowerCase().trim();
  const existing = ACTORS.find((a) => a.slug.toLowerCase() === clean);
  if (existing) return existing;

  // Derive from movies if not explicitly in static ACTORS array
  for (const movie of MOVIES) {
    const castMatch = movie.cast.find((c) => c.slug.toLowerCase() === clean);
    if (castMatch) {
      return {
        id: castMatch.actorId,
        slug: castMatch.slug,
        name: castMatch.name,
        tmdbPersonId: getTmdbPersonIdForSlug(castMatch.slug),
        photoUrl: castMatch.profileUrl,
      };
    }
  }
  return undefined;
}

export function getActorByTmdbId(tmdbPersonId: number): Actor | undefined {
  const existing = ACTORS.find((a) => a.tmdbPersonId === tmdbPersonId);
  if (existing) return existing;

  for (const movie of MOVIES) {
    const castMatch = movie.cast.find(
      (c) => getTmdbPersonIdForSlug(c.slug) === tmdbPersonId
    );
    if (castMatch) {
      return {
        id: castMatch.actorId,
        slug: castMatch.slug,
        name: castMatch.name,
        tmdbPersonId,
        photoUrl: castMatch.profileUrl,
      };
    }
  }
  return undefined;
}

export function getActorByIdentifier(identifier: string | number): Actor | undefined {
  if (typeof identifier === 'number' || /^\d+$/.test(String(identifier).trim())) {
    const byId = getActorByTmdbId(parseInt(String(identifier).trim(), 10));
    if (byId) return byId;
  }
  return getActorBySlug(String(identifier).trim());
}

export function getAllActors(): Actor[] {
  const map = new Map<string, Actor>();
  for (const a of ACTORS) {
    map.set(a.slug, a);
  }
  for (const m of MOVIES) {
    for (const c of m.cast) {
      if (!map.has(c.slug)) {
        map.set(c.slug, {
          id: c.actorId,
          slug: c.slug,
          name: c.name,
          tmdbPersonId: getTmdbPersonIdForSlug(c.slug),
          photoUrl: c.profileUrl,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export interface BrandActorStat {
  actor: Actor;
  movieCount: number;
}

/**
 * Calculates top actors for a specific brand ranked strictly by the
 * number of Christmas movies belonging to that brand.
 */
export function getPopularActorsByBrand(brandId: string, limit: number = 6): BrandActorStat[] {
  const brandMovies = MOVIES.filter(
    (m) => m.brandId.toLowerCase() === brandId.toLowerCase().trim()
  );

  if (brandMovies.length === 0) {
    return [];
  }

  // Count appearances in distinct movies for this brand
  const countMap = new Map<string, number>();
  const sampleMap = new Map<
    string,
    { actorId: string; name: string; slug: string; tmdbPersonId?: number; profileUrl?: string }
  >();

  for (const movie of brandMovies) {
    const seenInThisMovie = new Set<string>();
    for (const member of movie.cast) {
      const cleanSlug = member.slug.toLowerCase().trim();
      if (!cleanSlug || seenInThisMovie.has(cleanSlug)) continue;
      seenInThisMovie.add(cleanSlug);

      countMap.set(cleanSlug, (countMap.get(cleanSlug) || 0) + 1);
      if (!sampleMap.has(cleanSlug) || (!sampleMap.get(cleanSlug)?.profileUrl && member.profileUrl)) {
        sampleMap.set(cleanSlug, member);
      }
    }
  }

  const results: BrandActorStat[] = [];

  for (const [slug, movieCount] of countMap.entries()) {
    let actor = getActorBySlug(slug);
    if (!actor) {
      const sample = sampleMap.get(slug);
      const tmdbPersonId = sample?.tmdbPersonId || getTmdbPersonIdForSlug(slug);
      actor = {
        id: sample?.actorId || slug,
        slug,
        name: sample?.name || slug,
        tmdbPersonId,
        photoUrl: sample?.profileUrl,
      };
    } else if (!actor.photoUrl && sampleMap.get(slug)?.profileUrl) {
      actor = {
        ...actor,
        photoUrl: sampleMap.get(slug)?.profileUrl,
      };
    }

    results.push({ actor, movieCount });
  }

  // Rank by number of Christmas movies for this brand (descending), then alphabetically
  results.sort((a, b) => {
    if (b.movieCount !== a.movieCount) {
      return b.movieCount - a.movieCount;
    }
    return a.actor.name.localeCompare(b.actor.name);
  });

  return results.slice(0, limit);
}
