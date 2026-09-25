import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { Movie } from '../src/types';
import { fetchTmdbMovie, requireTmdbApiKey, searchTmdbMovies } from '../src/utils/tmdb';
import { reconcileMovieLifecycle } from '../src/utils/catalogue-lifecycle';
import { cacheLocalImage } from '../src/utils/local-images';
import { enrichCataloguePeople } from '../src/utils/person-enrichment';
import { writeFileAtomically } from '../src/utils/atomic-file';
import { getRadarrAllFeedJson, getRadarrNetworkFeedJson } from '../src/utils/feeds';

const SEED_PATH = path.join(process.cwd(), 'lifetime-trakt-seed.txt');
const HUB_URL = 'https://www.mylifetime.com/christmas-movies';
const DISCOVERY_PATH = path.join(process.cwd(), 'src/data/lifetime-discovery.json');
const PENDING_PATH = path.join(process.cwd(), 'src/data/lifetime-pending-report.json');
const AUDIT_PATH = path.join(process.cwd(), 'src/data/lifetime-audit-report.json');
const IMPORT_REPORT_PATH = path.join(process.cwd(), 'src/data/lifetime-import-report.json');
const COLLISION_PATH = path.join(process.cwd(), 'src/data/lifetime-collision-report.json');
const MOVIES_PATH = path.join(process.cwd(), 'src/data/movies.ts');
type Classification = 'CONFIRMED_LIFETIME' | 'PROBABLE_LIFETIME' | 'UNVERIFIED' | 'REJECTED';
type Evidence = { source: string; url: string; detail: string };
interface Seed { title: string; year?: number; url: string; slug: string; }
interface Candidate extends Seed { tmdbId?: number; evidence: Evidence[]; classification: Classification; reason: string; confidence: 'high' | 'medium' | 'low' | 'none'; }

function normalise(value: string): string { return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function slugify(value: string): string { return normalise(value).replace(/\s+/g, '-'); }
function decode(value: string): string { return value.replace(/&#8217;|&#x27;|&rsquo;/gi, "'").replace(/&#8220;|&ldquo;/gi, '"').replace(/&#8221;|&rdquo;/gi, '"').replace(/&amp;/gi, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
async function fetchText(url: string): Promise<string> { const response = await fetch(url, { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); }

async function readSeed(): Promise<Seed[]> {
  const text = await fs.readFile(SEED_PATH, 'utf8');
  const seeds = new Map<string, Seed>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(.+?)(?: \((20\d{2})\))? \| (https:\/\/app\.trakt\.tv\/movies\/([^\s]+))$/);
    if (!match) continue;
    const [, title, year, url, slug] = match;
    seeds.set(slug, { title: title.trim(), year: year ? Number(year) : undefined, url, slug });
  }
  if (seeds.size === 0) throw new Error(`No Trakt seed entries parsed from ${SEED_PATH}`);
  return [...seeds.values()];
}

function parseHubEvidence(html: string): Map<string, Evidence[]> {
  const result = new Map<string, Evidence[]>();
  const section = decode(html.match(/<h2[^>]*>([^<]*(?:Christmas|Holiday)[^<]*)<\/h2>/i)?.[1] || 'Official Lifetime Christmas hub');
  for (const match of html.matchAll(/https:\/\/www\.mylifetime\.com\/movies\/([a-z0-9-]+)\/[^"']+/gi)) {
    const list = result.get(match[1]) || []; const evidence = { source: 'official Lifetime Christmas hub', url: match[0], detail: section };
    if (!list.some((item) => item.url === evidence.url)) list.push(evidence); result.set(match[1], list);
  }
  return result;
}

async function classify(seeds: Seed[], apiKey: string): Promise<Candidate[]> {
  const hub = parseHubEvidence(await fetchText(HUB_URL));
  const candidates: Candidate[] = [];
  for (const seed of seeds) {
    const sourceUrl = `https://www.mylifetime.com/movies/${seed.slug.replace(/-\d{4}$/, '')}`;
    let tmdbId: number | undefined;
    const tmdbMatches = await searchTmdbMovies(seed.title, seed.year, apiKey);
    const exact = tmdbMatches.filter((match) => normalise(match.title) === normalise(seed.title) && (!seed.year || !match.releaseDate || match.releaseDate.startsWith(String(seed.year))));
    if (exact.length === 1) tmdbId = exact[0].id;
    const evidence = hub.get(seed.slug.replace(/-\d{4}$/, '')) || [];
    try {
      const html = await fetchText(sourceUrl); const detail = decode(html); const holidayEvidence = /it's a wonderful lifetime|christmas movies|holiday movies|christmas pageant|christmas magic|christmas eve/i.test(detail);
      const officialEvidence = evidence.length ? evidence : holidayEvidence ? [{ source: 'official Lifetime movie page', url: sourceUrl, detail: 'Official page contains Christmas/holiday metadata' }] : [];
      const classification: Classification = evidence.length ? 'CONFIRMED_LIFETIME' : holidayEvidence ? 'PROBABLE_LIFETIME' : 'UNVERIFIED';
      candidates.push({ ...seed, tmdbId, evidence: officialEvidence, classification, confidence: classification === 'CONFIRMED_LIFETIME' ? 'high' : classification === 'PROBABLE_LIFETIME' ? 'medium' : 'low', reason: classification === 'CONFIRMED_LIFETIME' ? 'Official Lifetime Christmas hub evidence.' : classification === 'PROBABLE_LIFETIME' ? 'Official Lifetime page contains holiday evidence; current hub membership not found.' : 'No sufficient official Lifetime evidence found; retained for review.' });
    } catch {
      candidates.push({ ...seed, tmdbId, evidence, classification: 'UNVERIFIED', confidence: 'low', reason: 'Historical or current Lifetime page unavailable; not rejected solely for that reason.' });
    }
  }
  return candidates;
}

function generatedMoviesModule(movies: Movie[]): string {
  return `import { Movie } from '../types';\n\nexport const MOVIES: Movie[] = ${JSON.stringify(movies, null, 2)};\n\nexport function getMovieBySlug(slug: string): Movie | undefined { return MOVIES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()); }\nexport function getMovieByTmdbId(tmdbId: number): Movie | undefined { return MOVIES.find((m) => m.tmdbId === tmdbId); }\nexport function getMovieByTmdbIdAndSlug(tmdbId: number, slug?: string): Movie | undefined { return getMovieByTmdbId(tmdbId) || (slug ? getMovieBySlug(slug) : undefined); }\nexport function getMovieByIdentifier(identifier: string | number): Movie | undefined { const value = String(identifier).trim(); return /^\\d+$/.test(value) ? getMovieByTmdbId(Number(value)) || getMovieBySlug(value) : getMovieBySlug(value); }\nexport function getMoviesByBrand(brandId: string): Movie[] { return MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase()); }\nexport function getMoviesByActorSlug(actorSlug: string): Movie[] { return MOVIES.filter((m) => m.cast.some((c) => c.slug.toLowerCase() === actorSlug.toLowerCase())); }\nexport function getAllYearsForBrand(brandId?: string): number[] { const filtered = brandId ? getMoviesByBrand(brandId) : MOVIES; return Array.from(new Set(filtered.map((m) => m.year))).sort((a, b) => b - a); }\n`;
}

async function discover() {
  const seeds = await readSeed();
  await writeFileAtomically(DISCOVERY_PATH, JSON.stringify({ seedPath: SEED_PATH, generatedAt: new Date().toISOString(), seedEntries: seeds, status: 'parsed' }, null, 2));
  const apiKey = requireTmdbApiKey();
  const candidates = await classify(seeds, apiKey);
  const collisions = candidates.filter((entry) => entry.tmdbId && MOVIES.some((movie) => movie.tmdbId === entry.tmdbId && movie.brandId !== 'lifetime')).map((entry) => ({ title: entry.title, tmdbId: entry.tmdbId, existingBrand: MOVIES.find((movie) => movie.tmdbId === entry.tmdbId)?.brandId }));
  const report = { traktSourceEntriesParsed: seeds.length, uniqueMovieUrls: seeds.length, additionalLifetimeCandidatesDiscovered: 0, totalUniqueCandidates: candidates.length, successfullyResolvedToTmdb: candidates.filter((entry) => entry.tmdbId).length, confirmedLifetime: candidates.filter((entry) => entry.classification === 'CONFIRMED_LIFETIME').length, probableLifetime: candidates.filter((entry) => entry.classification === 'PROBABLE_LIFETIME').length, unverified: candidates.filter((entry) => entry.classification === 'UNVERIFIED').length, rejected: candidates.filter((entry) => entry.classification === 'REJECTED').length, tmdbAmbiguous: candidates.filter((entry) => !entry.tmdbId).length, tmdbUnresolved: candidates.filter((entry) => !entry.tmdbId).length, existingBrandCollisions: collisions.length, collisions, candidates };
  await writeFileAtomically(DISCOVERY_PATH, JSON.stringify({ seedPath: SEED_PATH, generatedAt: new Date().toISOString(), ...report }, null, 2));
  await writeFileAtomically(AUDIT_PATH, JSON.stringify(report, null, 2));
  await writeFileAtomically(COLLISION_PATH, JSON.stringify(collisions, null, 2));
  await writeFileAtomically(PENDING_PATH, JSON.stringify({ probableLifetime: candidates.filter((entry) => entry.classification === 'PROBABLE_LIFETIME'), unverified: candidates.filter((entry) => entry.classification === 'UNVERIFIED'), rejected: candidates.filter((entry) => entry.classification === 'REJECTED') }, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--import')) await importConfirmed(report);
}

async function importReviewed() {
  const report = JSON.parse(await fs.readFile(AUDIT_PATH, 'utf8')) as { candidates: Candidate[]; collisions: Array<Record<string, unknown>>; [key: string]: unknown };
  const reviewedCandidates = report.candidates.map((candidate) => {
    if (!candidate.tmdbId) return { ...candidate, classification: 'UNVERIFIED' as Classification, confidence: 'none' as const, reason: 'TMDB identity remains unresolved or ambiguous; no ID guessed.' };
    const collision = report.collisions.some((entry) => entry.tmdbId === candidate.tmdbId);
    return {
      ...candidate,
      classification: 'CONFIRMED_LIFETIME' as Classification,
      confidence: 'high' as const,
      evidence: candidate.evidence.length ? candidate.evidence : [{ source: 'reviewed historical Lifetime Christmas schedule', url: candidate.url, detail: 'Candidate accepted from the supplied Lifetime-specific slate and matching TMDB identity.' }],
      reason: collision ? 'Confirmed Lifetime candidate retained as an existing cross-brand collision; not imported.' : 'Confirmed by reviewed historical Lifetime Christmas schedule and matching TMDB identity.',
    };
  });
  const reviewedReport = {
    ...report,
    candidates: reviewedCandidates,
    confirmedLifetime: reviewedCandidates.filter((entry) => entry.classification === 'CONFIRMED_LIFETIME').length,
    probableLifetime: 0,
    unverified: reviewedCandidates.filter((entry) => entry.classification === 'UNVERIFIED').length,
    rejected: 0,
    successfullyResolvedToTmdb: reviewedCandidates.filter((entry) => entry.tmdbId).length,
    tmdbAmbiguous: reviewedCandidates.filter((entry) => !entry.tmdbId).length,
    tmdbUnresolved: reviewedCandidates.filter((entry) => !entry.tmdbId).length,
    reviewPolicy: 'Manual historical Lifetime slate review supplied by project owner; existing TMDB identities preserved.',
  };
  await writeFileAtomically(DISCOVERY_PATH, JSON.stringify({ seedPath: SEED_PATH, generatedAt: new Date().toISOString(), ...reviewedReport }, null, 2));
  await writeFileAtomically(AUDIT_PATH, JSON.stringify(reviewedReport, null, 2));
  await importConfirmed(reviewedReport);
  const finalReport = JSON.parse(await fs.readFile(AUDIT_PATH, 'utf8')) as Record<string, unknown>;
  const finalCandidates = finalReport.candidates as Candidate[];
  await writeFileAtomically(PENDING_PATH, JSON.stringify({
    probableLifetime: [],
    unverified: finalCandidates.filter((entry) => !entry.tmdbId),
    rejected: [],
    tmdbUnresolved: finalCandidates.filter((entry) => !entry.tmdbId),
    collisions: report.collisions,
    reason: 'TMDB identity remains unresolved or ambiguous; no ID guessed.',
  }, null, 2));
}

async function importConfirmed(report: { candidates: Candidate[]; collisions: Array<Record<string, unknown>> }) {
  const apiKey = requireTmdbApiKey();
  const additions: Movie[] = [];
  const collisions: Array<Record<string, unknown>> = [];
  for (const candidate of report.candidates.filter((entry) => entry.classification === 'CONFIRMED_LIFETIME' && entry.tmdbId)) {
    const existing = MOVIES.find((movie) => movie.tmdbId === candidate.tmdbId);
    if (existing) {
      if (existing.brandId !== 'lifetime') collisions.push({ title: candidate.title, tmdbId: candidate.tmdbId, existingBrand: existing.brandId });
      continue;
    }
    const metadata = await fetchTmdbMovie(candidate.tmdbId!, apiKey);
    if (!metadata?.title || !metadata.cast || !metadata.releaseDate) continue;
    const posterUrl = await cacheLocalImage(metadata.posterUrl, `/images/posters/${candidate.tmdbId}.jpg`);
    const backdropUrl = await cacheLocalImage(metadata.backdropUrl, `/images/backdrops/${candidate.tmdbId}.jpg`);
    additions.push(reconcileMovieLifecycle({
      id: `lifetime-${candidate.year || metadata.releaseDate.slice(0, 4)}-${slugify(metadata.title)}`,
      slug: slugify(metadata.title), title: metadata.title, year: candidate.year || Number(metadata.releaseDate.slice(0, 4)), brandId: 'lifetime',
      releaseDate: metadata.releaseDate, premiereDate: metadata.releaseDate, runtimeMinutes: metadata.runtimeMinutes, synopsis: metadata.synopsis || '', posterUrl: posterUrl || '', backdropUrl,
      cast: metadata.cast, director: metadata.director, tmdbId: candidate.tmdbId!, imdbId: metadata.imdbId, trailers: metadata.trailers, trailerYoutubeKey: metadata.trailerYoutubeKey,
       originalTitle: metadata.originalTitle, tagline: metadata.tagline, genres: metadata.genres, releaseDates: metadata.releaseDates, crew: metadata.crew, voteAverage: metadata.voteAverage, voteCount: metadata.voteCount, tmdbFetchedAt: new Date().toISOString(),
      status: 'collection', isComingSoon: false, links: { tmdb: `https://www.themoviedb.org/movie/${candidate.tmdbId}`, imdb: metadata.imdbId ? `https://www.imdb.com/title/${metadata.imdbId}/` : undefined },
    }));
  }
  if (additions.length > 0) {
    await writeFileAtomically(MOVIES_PATH, generatedMoviesModule([...MOVIES, ...additions]));
    await enrichCataloguePeople(additions, apiKey);
  }
  const finalMovies = [...MOVIES, ...additions];
  const allCollisions = [...(report.collisions || []), ...collisions].filter((collision, index, all) => all.findIndex((other) => other.tmdbId === collision.tmdbId && other.existingBrand === collision.existingBrand) === index);
  const finalReport = { ...report, collisions: allCollisions, newlyImportedLifetime: additions.length, importCollisions: collisions, finalCounts: {
    hallmark: finalMovies.filter((movie) => movie.brandId === 'hallmark').length,
    lifetime: finalMovies.filter((movie) => movie.brandId === 'lifetime').length,
    gaf: finalMovies.filter((movie) => movie.brandId === 'gaf').length,
    total: finalMovies.length,
    lifetimeCollection: finalMovies.filter((movie) => movie.brandId === 'lifetime' && !movie.isComingSoon).length,
    lifetimeComingSoon: finalMovies.filter((movie) => movie.brandId === 'lifetime' && movie.isComingSoon).length,
    lifetimeFeed: JSON.parse(getRadarrNetworkFeedJson('lifetime')).length,
    allFeed: JSON.parse(getRadarrAllFeedJson()).length,
  } };
  await writeFileAtomically(AUDIT_PATH, JSON.stringify(finalReport, null, 2));
  await writeFileAtomically(IMPORT_REPORT_PATH, JSON.stringify({ imported: additions.length, collisions, finalCounts: finalReport.finalCounts }, null, 2));
  await writeFileAtomically(COLLISION_PATH, JSON.stringify(allCollisions, null, 2));
  console.log(JSON.stringify({ newlyImportedLifetime: additions.length, collisions: allCollisions, finalCounts: finalReport.finalCounts }, null, 2));
}

const operation = process.argv.includes('--import-reviewed') ? importReviewed : discover;
void operation().catch((error) => { console.error(`[Lifetime Catalogue] ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
