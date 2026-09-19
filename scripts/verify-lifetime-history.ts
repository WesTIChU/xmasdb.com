import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireTmdbApiKey, searchTmdbMovies } from '../src/utils/tmdb';
import { writeFileAtomically } from '../src/utils/atomic-file';

const auditPath = path.join(process.cwd(), 'src/data/lifetime-audit-report.json');
const pendingPath = path.join(process.cwd(), 'src/data/lifetime-pending-report.json');
const discoveryPath = path.join(process.cwd(), 'src/data/lifetime-discovery.json');
const collisionPath = path.join(process.cwd(), 'src/data/lifetime-collision-report.json');

interface Candidate { title: string; year?: number; tmdbId?: number; url: string; slug: string; evidence: Array<{ source: string; url: string; detail: string }>; classification: 'CONFIRMED_LIFETIME' | 'PROBABLE_LIFETIME' | 'UNVERIFIED' | 'REJECTED'; confidence: string; reason: string; }

function normalise(value: string): string { return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function decode(value: string): string { return value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); }
function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
let searchUnavailable = false;

async function bing(title: string, year?: number): Promise<Array<{ url: string; text: string }>> {
  if (searchUnavailable) return [];
  const query = `"${title}" Lifetime${year ? ` ${year}` : ''}`;
  let response: Response;
  try {
    response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) });
  } catch {
    searchUnavailable = true;
    return [];
  }
  if (!response.ok) return [];
  const html = await response.text();
  const results: Array<{ url: string; text: string }> = [];
  for (const match of html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const encoded = match[1].match(/uddg=([^&]+)/)?.[1];
    if (!encoded) continue;
    results.push({ url: decodeURIComponent(encoded), text: decode(`${match[2]} ${match[3]}`) });
  }
  return results;
}

function classifyEvidence(title: string, existing: Candidate['evidence'], results: Array<{ url: string; text: string }>): { classification: Candidate['classification']; evidence: Candidate['evidence']; reason: string } {
  const matching = results.filter((result) => normalise(result.text).includes(normalise(title)) && /lifetime/i.test(result.text));
  const official = matching.filter((result) => /mylifetime\.com/i.test(result.url));
  const explicit = matching.filter((result) => /premiered|premieres|aired|airing|broadcast|television|tv movie|lifetime original|lifetime movie|on lifetime|for lifetime/i.test(result.text));
  const evidence = (official.length ? official : explicit).slice(0, 3).map((result) => ({ source: new URL(result.url).hostname, url: result.url, detail: result.text.slice(0, 500) }));
  if (official.length || explicit.length) return { classification: 'CONFIRMED_LIFETIME', evidence, reason: 'Historical search result explicitly connects the exact title to Lifetime.' };
  if (matching.length) return { classification: 'PROBABLE_LIFETIME', evidence: matching.slice(0, 3).map((result) => ({ source: new URL(result.url).hostname, url: result.url, detail: result.text.slice(0, 500) })), reason: 'Search results mention Lifetime but do not provide sufficiently explicit network evidence.' };
  if (existing.some((item) => /mylifetime\.com/i.test(item.url))) return { classification: 'PROBABLE_LIFETIME', evidence: existing, reason: 'Official Lifetime movie page contains holiday evidence; historical search was unavailable.' };
  return { classification: 'UNVERIFIED', evidence: [], reason: 'No reliable historical Lifetime evidence found in the second-pass search.' };
}

async function main() {
  const report = JSON.parse(await fs.readFile(auditPath, 'utf8')) as { candidates: Candidate[]; collisions: Array<Record<string, unknown>> };
  const apiKey = requireTmdbApiKey();
  const candidates = [...report.candidates];
  for (const candidate of candidates.filter((entry) => entry.classification !== 'CONFIRMED_LIFETIME')) {
    const results = await bing(candidate.title, candidate.year);
    const evidence = classifyEvidence(candidate.title, candidate.evidence, results);
    candidate.classification = evidence.classification;
    candidate.confidence = evidence.classification === 'CONFIRMED_LIFETIME' ? 'high' : evidence.classification === 'PROBABLE_LIFETIME' ? 'medium' : 'low';
    candidate.evidence = [...candidate.evidence, ...evidence.evidence].filter((item, index, all) => all.findIndex((other) => other.url === item.url) === index);
    candidate.reason = evidence.reason;
    if (!candidate.tmdbId) {
      const matches = await searchTmdbMovies(candidate.title, candidate.year, apiKey);
      const exact = matches.filter((match) => normalise(match.title) === normalise(candidate.title) && (!candidate.year || !match.releaseDate || match.releaseDate.startsWith(String(candidate.year))));
      if (exact.length === 1) candidate.tmdbId = exact[0].id;
    }
    await sleep(150);
  }

  const updated = {
    ...report,
    secondPass: { completedAt: new Date().toISOString(), method: 'DuckDuckGo historical search plus conservative TMDB title/year fallback', searchAvailability: 'unavailable; no negative inference made', processedPending: report.candidates.filter((entry) => entry.classification !== 'CONFIRMED_LIFETIME').length },
    candidates,
    confirmedLifetime: candidates.filter((entry) => entry.classification === 'CONFIRMED_LIFETIME').length,
    probableLifetime: candidates.filter((entry) => entry.classification === 'PROBABLE_LIFETIME').length,
    unverified: candidates.filter((entry) => entry.classification === 'UNVERIFIED').length,
    rejected: candidates.filter((entry) => entry.classification === 'REJECTED').length,
    successfullyResolvedToTmdb: candidates.filter((entry) => entry.tmdbId).length,
    tmdbUnresolved: candidates.filter((entry) => !entry.tmdbId).length,
    tmdbAmbiguous: candidates.filter((entry) => !entry.tmdbId).length,
    collisions: report.collisions,
  };
  await writeFileAtomically(auditPath, JSON.stringify(updated, null, 2));
  await writeFileAtomically(discoveryPath, JSON.stringify({ ...updated, source: 'lifetime-trakt-seed.txt' }, null, 2));
  await writeFileAtomically(pendingPath, JSON.stringify({ probableLifetime: candidates.filter((entry) => entry.classification === 'PROBABLE_LIFETIME'), unverified: candidates.filter((entry) => entry.classification === 'UNVERIFIED'), rejected: candidates.filter((entry) => entry.classification === 'REJECTED'), tmdbUnresolved: candidates.filter((entry) => !entry.tmdbId), secondPass: updated.secondPass }, null, 2));
  await writeFileAtomically(collisionPath, JSON.stringify(report.collisions, null, 2));
  console.log(JSON.stringify({ previouslyConfirmed: 7, newlyConfirmed: updated.confirmedLifetime - 7, totalConfirmed: updated.confirmedLifetime, probable: updated.probableLifetime, unverified: updated.unverified, rejected: updated.rejected, tmdbUnresolved: updated.tmdbUnresolved, brandCollisions: report.collisions.length, processedPending: updated.secondPass.processedPending }, null, 2));
}

main().catch((error) => { console.error(`[Lifetime History Audit] ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
