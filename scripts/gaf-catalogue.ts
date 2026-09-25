import 'dotenv/config';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { Movie } from '../src/types';
import { fetchTmdbMovie, requireTmdbApiKey, searchTmdbMovies } from '../src/utils/tmdb';
import { reconcileMovieLifecycle } from '../src/utils/catalogue-lifecycle';
import { cacheLocalImage } from '../src/utils/local-images';
import { writeFileAtomically } from '../src/utils/atomic-file';
import { enrichCataloguePeople } from '../src/utils/person-enrichment';

const SOURCE_URL = 'https://www.greatamericanfamily.com/celebrations/';
const moviesPath = path.join(process.cwd(), 'src/data/movies.ts');
const discoveryPath = path.join(process.cwd(), 'src/data/gaf-discovery.json');
const reportPath = path.join(process.cwd(), 'src/data/gaf-import-report.json');

const GAF_ALTERNATE_TITLES: Record<string, string[]> = {
  'pencil me in for christmas': ['Creating Christmas'],
  'a royal icing christmas': ['Once Upon a Christmas Crown'],
  'a christmas castle proposal': ['A Christmas Castle Proposal: A Royal in Paradise II'],
  'the jingle bell jubilee': ['The Jinglebell Jubilee'],
  'a paris christmas waltz': ['Paris Christmas Waltz'],
  'a hot cocoa christmas': ['Hot Chocolate Holiday'],
  'a cozy christmas quilt': ['The Fabric of Christmas'],
  'christmas lovers anonymous': ['Christmas Lovers Anonymous'],
  'chasing christmas': ['Mario Lopez Presents: Chasing Christmas'],
  'destined 2 christmas once more': ['Destined 2: Christmas Once More'],
};

const APPROVED_ALTERNATE_IDS: Record<string, number> = {
  'pencil me in for christmas': 1129782,
  'a royal icing christmas': 1491727,
  'a christmas castle proposal': 1231623,
  'the jingle bell jubilee': 1180367,
  'a paris christmas waltz': 1127936,
  'a hot cocoa christmas': 777405,
  'a cozy christmas quilt': 1131992,
  'christmas lovers anonymous': 883901,
  'chasing christmas': 1553895,
  'a christmas blessing': 1142044,
  'let it snow': 240906,
  'destined 2 christmas once more': 1137856,
};

interface GafSourceEntry {
  title: string;
  year?: number;
  sourceUrl: string;
  premiereText?: string;
  premiereDate?: string;
}

interface GafCandidate extends GafSourceEntry {
  year: number;
}

interface GafDiscovery {
  sourceUrl: string;
  discoveredAt: string;
  entries: GafSourceEntry[];
  candidates: GafCandidate[];
  duplicates: GafSourceEntry[];
  parseFailures: Array<{ title?: string; year?: number; sourceUrl?: string; reason: string }>;
  sourceErrors: string[];
}

interface ImportReport {
  sourceUrl: string;
  discovered: number;
  uniqueTitles: number;
  totalEntriesDiscovered: number;
  successfullyMatched: number;
  importedAsGaf: number;
  noTmdbMatch: number;
  titlesByYear: Record<string, number>;
  confidentlyMatched: number;
  alreadyPresent: number;
  updatedExisting: number;
  newlyImported: number;
  ambiguous: Array<{ title: string; year: number; candidates: Array<{ id: number; title: string; releaseDate?: string }> }>;
  unmatched: Array<{ title: string; year: number; candidates: Array<{ id: number; title: string; releaseDate?: string }> }>;
  collisions: Array<{ title: string; year: number; tmdbId: number; existingBrand: string }>;
  skipped: Array<{ title: string; year?: number; reason: string }>;
  collection: number;
  comingSoon: number;
  futureWithoutExactDate: number;
  imageFailures: Array<{ title: string; tmdbId: number; poster: boolean; backdrop: boolean }>;
  parseFailures: Array<{ title?: string; year?: number; sourceUrl?: string; reason: string }>;
  duplicates: GafSourceEntry[];
  notImported: Array<{ title: string; year?: number; reason: string; candidates?: Array<{ id: number; title: string; releaseDate?: string }> }>;
  sourceErrors: string[];
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#8217;|&#x27;|&rsquo;/gi, "'")
    .replace(/&#8220;|&#x22;|&ldquo;/gi, '"')
    .replace(/&#8221;|&rdquo;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'));
  return match?.[1];
}

function normaliseTitle(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function parseDate(value: string | undefined, fallbackYear?: number): string | undefined {
  if (!value) return undefined;
  const match = value.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(20\d{2}))?\b/i);
  if (!match) return undefined;
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };
  const year = match[3] || (fallbackYear ? String(fallbackYear) : undefined);
  return year ? `${year}-${months[match[1].toLowerCase()]}-${match[2].padStart(2, '0')}` : undefined;
}

function parseYearFilters(html: string): Map<string, number> {
  const filters = new Map<string, number>();
  const pattern = /<[^>]*data-filter=["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\//gi;
  for (const match of html.matchAll(pattern)) {
    const year = match[2].match(/\b(20\d{2})\b/)?.[1];
    if (year) filters.set(match[1], Number(year));
  }
  return filters;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function parseDetail(url: string, year?: number): Promise<Pick<GafCandidate, 'premiereText' | 'premiereDate'>> {
  try {
    const html = await fetchText(url);
    const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => decodeHtml(match[1]));
    const premiereText = paragraphs.find((paragraph) => /\bpremier(?:ed|es)?\b/i.test(paragraph));
    return { premiereText, premiereDate: parseDate(premiereText, year) };
  } catch {
    return {};
  }
}

async function discover(): Promise<GafDiscovery> {
  const html = await fetchText(SOURCE_URL);
  const filters = parseYearFilters(html);
  const fallbackFilters = new Map([
    ['720', 2021], ['719', 2022], ['784', 2023], ['796', 2024], ['860', 2025], ['920', 2026],
  ]);
  for (const [key, year] of fallbackFilters) if (!filters.has(key)) filters.set(key, year);

  const entries: GafSourceEntry[] = [];
  const candidates: GafCandidate[] = [];
  const duplicates: GafSourceEntry[] = [];
  const parseFailures: GafDiscovery['parseFailures'] = [];
  const sourceErrors: string[] = [];
  const articlePattern = /<article\b([^>]*elementor-portfolio-item[^>]*)>([\s\S]*?)<\/article>/gi;
  for (const match of html.matchAll(articlePattern)) {
    const tag = match[1];
    const body = match[2];
    const className = attribute(tag, 'class') || '';
    const filterId = className.match(/elementor-filter-([^\s"]+)/)?.[1];
    const year = filterId ? filters.get(filterId) : undefined;
    const title = decodeHtml(body.match(/class=["'][^"']*elementor-portfolio-item__title[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || '');
    const href = body.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1];
    if (!title || !href) {
      parseFailures.push({ reason: 'Missing title or detail URL in a catalogue card' });
      continue;
    }
    const sourceUrl = new URL(href, SOURCE_URL).toString();
    if (!year) {
      const entry = { title, sourceUrl };
      entries.push(entry);
      parseFailures.push({ title, sourceUrl, reason: 'Could not determine GAF year from the card filter' });
      continue;
    }
    const detail = await parseDetail(sourceUrl, year);
    entries.push({ title, year, sourceUrl, ...detail });
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.year || 'unknown'}:${normaliseTitle(entry.title)}`;
    if (seen.has(key)) {
      duplicates.push(entry);
      continue;
    }
    seen.add(key);
    if (entry.year) candidates.push(entry as GafCandidate);
  }

  if (candidates.length === 0) throw new Error('No GAF Christmas catalogue candidates were parsed; local data was not changed.');
  sourceErrors.push(...parseFailures.map((failure) => `${failure.title || 'Unknown card'}: ${failure.reason}`));
  const result = { sourceUrl: SOURCE_URL, discoveredAt: new Date().toISOString(), entries, candidates, duplicates, parseFailures, sourceErrors };
  await writeFileAtomically(discoveryPath, JSON.stringify(result, null, 2));
  return result;
}

function generatedMoviesModule(movies: Movie[]): string {
  return `import { Movie } from '../types';\n\nexport const MOVIES: Movie[] = ${JSON.stringify(movies, null, 2)};\n\nexport function getMovieBySlug(slug: string): Movie | undefined { return MOVIES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()); }\nexport function getMovieByTmdbId(tmdbId: number): Movie | undefined { return MOVIES.find((m) => m.tmdbId === tmdbId); }\nexport function getMovieByTmdbIdAndSlug(tmdbId: number, slug?: string): Movie | undefined { return getMovieByTmdbId(tmdbId) || (slug ? getMovieBySlug(slug) : undefined); }\nexport function getMovieByIdentifier(identifier: string | number): Movie | undefined { const value = String(identifier).trim(); return /^\\d+$/.test(value) ? getMovieByTmdbId(Number(value)) || getMovieBySlug(value) : getMovieBySlug(value); }\nexport function getMoviesByBrand(brandId: string): Movie[] { return MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase()); }\nexport function getMoviesByActorSlug(actorSlug: string): Movie[] { return MOVIES.filter((m) => m.cast.some((c) => c.slug.toLowerCase() === actorSlug.toLowerCase())); }\nexport function getAllYearsForBrand(brandId?: string): number[] { const filtered = brandId ? getMoviesByBrand(brandId) : MOVIES; return Array.from(new Set(filtered.map((m) => m.year))).sort((a, b) => b - a); }\n`;
}

function statusFor(candidate: GafCandidate, releaseDate: string): 'collection' | 'coming-soon' {
  const date = candidate.premiereDate || releaseDate;
  return date > new Date().toISOString().slice(0, 10) ? 'coming-soon' : 'collection';
}

async function importGaf(discovery: GafDiscovery): Promise<void> {
  const apiKey = requireTmdbApiKey();
  const report: ImportReport = {
    sourceUrl: SOURCE_URL,
    discovered: discovery.entries.length,
    uniqueTitles: discovery.entries.length - discovery.duplicates.length,
    totalEntriesDiscovered: discovery.entries.length,
    successfullyMatched: 0,
    importedAsGaf: 0,
    noTmdbMatch: 0,
    titlesByYear: {},
    confidentlyMatched: 0,
    alreadyPresent: 0,
    updatedExisting: 0,
    newlyImported: 0,
    ambiguous: [],
    unmatched: [],
    collisions: [],
    skipped: [],
    collection: 0,
    comingSoon: 0,
    futureWithoutExactDate: 0,
    imageFailures: [],
    parseFailures: discovery.parseFailures,
    duplicates: discovery.duplicates,
    notImported: discovery.parseFailures.map((failure) => ({ title: failure.title || 'Unknown card', year: failure.year, reason: failure.reason })),
    sourceErrors: discovery.sourceErrors,
  };
  for (const candidate of discovery.candidates) report.titlesByYear[candidate.year] = (report.titlesByYear[candidate.year] || 0) + 1;
  report.futureWithoutExactDate = discovery.candidates.filter((candidate) => candidate.year >= new Date().getUTCFullYear() && !candidate.premiereDate).length;

  const additions: Movie[] = [];
  const existingByTmdb = new Map(MOVIES.map((movie) => [movie.tmdbId, movie]));
  for (const candidate of discovery.candidates) {
    const queries = [candidate.title, ...(GAF_ALTERNATE_TITLES[normaliseTitle(candidate.title)] || [])];
    const matchesById = new Map<number, { id: number; title: string; releaseDate?: string }>();
    for (const query of queries) {
      for (const match of await searchTmdbMovies(query, query === candidate.title ? candidate.year : undefined, apiKey)) matchesById.set(match.id, match);
    }
    const matches = [...matchesById.values()];
    const approvedId = APPROVED_ALTERNATE_IDS[normaliseTitle(candidate.title)];
    let exact = approvedId
      ? matches.filter((match) => match.id === approvedId)
      : matches.filter((match) => queries.some((query) => normaliseTitle(match.title) === normaliseTitle(query)) && (!candidate.year || !match.releaseDate || match.releaseDate.startsWith(String(candidate.year))));
    if (approvedId && exact.length === 0) exact = [{ id: approvedId, title: candidate.title }];
    if (exact.length !== 1) {
      const existingGaf = MOVIES.find((movie) => movie.brandId === 'gaf' && queries.some((query) => normaliseTitle(movie.title) === normaliseTitle(query)));
      if (existingGaf) {
        report.alreadyPresent++;
        report.successfullyMatched++;
        report.confidentlyMatched++;
        report.importedAsGaf++;
        if (!existingGaf.posterUrl || !existingGaf.backdropUrl) report.imageFailures.push({ title: existingGaf.title, tmdbId: existingGaf.tmdbId, poster: Boolean(existingGaf.posterUrl), backdrop: Boolean(existingGaf.backdropUrl) });
        continue;
      }
    }
    if (exact.length !== 1) {
      const entry = { title: candidate.title, year: candidate.year, candidates: matches };
      if (exact.length > 1) {
        report.ambiguous.push(entry);
        report.notImported.push({ ...entry, reason: `Multiple exact TMDB matches: ${matches.map((match) => `${match.title} [${match.id}]`).join(', ')}` });
      } else {
        report.unmatched.push(entry);
        report.notImported.push({ ...entry, reason: 'No confident TMDB title/year match' });
      }
      continue;
    }
    report.confidentlyMatched++;
    report.successfullyMatched++;
    const match = exact[0];
    const existing = existingByTmdb.get(match.id);
    if (existing) {
      report.alreadyPresent++;
      if (existing.brandId !== 'gaf') {
        report.collisions.push({ title: candidate.title, year: candidate.year, tmdbId: match.id, existingBrand: existing.brandId });
        report.notImported.push({ title: candidate.title, year: candidate.year, reason: `TMDB ID already belongs to ${existing.brandId} in XmasDB` });
      } else if (candidate.premiereDate && candidate.premiereDate !== existing.premiereDate) {
        const status = statusFor(candidate, candidate.premiereDate);
        additions.push({ ...existing, releaseDate: candidate.premiereDate, premiereDate: candidate.premiereDate, status, isComingSoon: status === 'coming-soon' });
        report.updatedExisting++;
      }
      if (existing.brandId === 'gaf') report.importedAsGaf++;
      if (existing.brandId === 'gaf' && (!existing.posterUrl || !existing.backdropUrl)) {
        report.imageFailures.push({ title: existing.title, tmdbId: existing.tmdbId, poster: Boolean(existing.posterUrl), backdrop: Boolean(existing.backdropUrl) });
      }
      continue;
    }

    const metadata = await fetchTmdbMovie(match.id, apiKey);
    if (!metadata?.title || !metadata.cast || !metadata.releaseDate) {
      report.skipped.push({ title: candidate.title, year: candidate.year, reason: 'TMDB details were incomplete' });
      report.notImported.push({ title: candidate.title, year: candidate.year, reason: 'TMDB details were incomplete after a title match' });
      continue;
    }
    const releaseDate = candidate.premiereDate || metadata.releaseDate;
    const status = statusFor(candidate, releaseDate);
    const posterUrl = await cacheLocalImage(metadata.posterUrl, `/images/posters/${match.id}.jpg`);
    const backdropUrl = await cacheLocalImage(metadata.backdropUrl, `/images/backdrops/${match.id}.jpg`);
    if (!posterUrl || !backdropUrl) report.imageFailures.push({ title: metadata.title, tmdbId: match.id, poster: Boolean(posterUrl), backdrop: Boolean(backdropUrl) });
    const movie: Movie = reconcileMovieLifecycle({
      id: `gaf-${candidate.year}-${normaliseTitle(metadata.title).replace(/\s+/g, '-')}`,
      slug: normaliseTitle(metadata.title).replace(/\s+/g, '-'),
      title: metadata.title,
      year: candidate.year,
      brandId: 'gaf',
      releaseDate,
      premiereDate: candidate.premiereDate,
      runtimeMinutes: metadata.runtimeMinutes,
      synopsis: metadata.synopsis || '',
      posterUrl: posterUrl || '',
      backdropUrl,
      cast: metadata.cast,
      director: metadata.director,
      tmdbId: match.id,
      imdbId: metadata.imdbId,
      trailers: metadata.trailers,
      trailerYoutubeKey: metadata.trailerYoutubeKey,
      originalTitle: metadata.originalTitle,
      tagline: metadata.tagline,
      genres: metadata.genres,
      releaseDates: metadata.releaseDates,
      crew: metadata.crew,
       voteAverage: metadata.voteAverage,
       voteCount: metadata.voteCount,
       tmdbFetchedAt: new Date().toISOString(),
       status,
      isComingSoon: status === 'coming-soon',
      links: {
        tmdb: `https://www.themoviedb.org/movie/${match.id}`,
        imdb: metadata.imdbId ? `https://www.imdb.com/title/${metadata.imdbId}/` : undefined,
      },
    });
    additions.push(movie);
    existingByTmdb.set(match.id, movie);
    report.newlyImported++;
    report.importedAsGaf++;
    if (movie.status === 'coming-soon') report.comingSoon++;
    else report.collection++;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  report.noTmdbMatch = report.unmatched.length;
  for (const duplicate of report.duplicates) {
    report.notImported.push({ title: duplicate.title, year: duplicate.year, reason: 'Duplicate title/year entry on the official GAF catalogue' });
  }

  if (additions.length > 0) {
    const additionsByTmdb = new Map(additions.map((movie) => [movie.tmdbId, movie]));
    const existingIds = new Set(MOVIES.map((movie) => movie.tmdbId));
    const mergedMovies = MOVIES.map((movie) => additionsByTmdb.get(movie.tmdbId) || movie)
      .concat(additions.filter((movie) => !existingIds.has(movie.tmdbId)));
    await writeFileAtomically(moviesPath, generatedMoviesModule(mergedMovies));
    const people = await enrichCataloguePeople(additions, apiKey);
    if (people.failures.length > 0) report.skipped.push(...people.failures.map((failure) => ({ title: failure.name, reason: `Actor enrichment failed: ${failure.message}` })));
  }
  await writeFileAtomically(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  const discovery = await discover();
  if (process.argv.includes('--import')) await importGaf(discovery);
  else console.log(JSON.stringify(discovery, null, 2));
}

main().catch((error) => {
  console.error(`[GAF Catalogue] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
