import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { searchTmdbMovies, fetchTmdbMovie, requireTmdbApiKey } from '../src/utils/tmdb';
import { writeFileAtomically } from '../src/utils/atomic-file';

const discoveryPath = path.join(process.cwd(), 'src/data/gaf-discovery.json');
const reportPath = path.join(process.cwd(), 'src/data/gaf-pending-report.json');

const PENDING_TITLES = [
  'A Christmas Rescue',
  'A Sweet Christmas Anniversary',
  'A Christmas Prayer II',
  'Christmas at the Starlight',
  'Silver Bells at Christmas',
  'The Trouble with Christmas Mistletoe',
  'An Accidental Arctic Christmas',
  'A Very Evergreen Christmas',
  'A Second Chance Christmas',
  'Pencil Me In For Christmas',
  'A Very Curious Christmas',
  'A Royal Icing Christmas',
  'Chasing Christmas',
  'Let It Snow',
  'A Cozy Christmas Quilt',
  'Christmas Castle Proposal',
  'Destined 2: Christmas Once More',
  'The Jingle Bell Jubilee',
  'A Paris Christmas Waltz',
  'A Christmas Blessing',
  'Candace Cameron Bure 2023 Christmas Movie',
  'Christmas Lovers Anonymous',
  'Christmas Sweethearts',
  'A Hot Cocoa Christmas',
];

const ALTERNATE_TITLES: Record<string, string[]> = {
  'a christmas prayer ii': ['A Christmas Prayer Tradition', 'A Christmas Prayer II'],
  'pencil me in for christmas': ['Creating Christmas'],
  'a cozy christmas quilt': ['The Fabric of Christmas'],
  'a hot cocoa christmas': ['Hot Chocolate Holiday'],
  'a royal icing christmas': ['Once Upon a Christmas Crown'],
  'christmas castle proposal': ['A Christmas Castle Proposal: A Royal in Paradise II'],
  'the jingle bell jubilee': ['The Jinglebell Jubilee'],
  'a paris christmas waltz': ['Paris Christmas Waltz'],
  'christmas sweethearts': ["My Best Friend's Christmas"],
  'christmas lovers anonymous': ['Christmas Lovers Anonymous'],
};

const APPROVED_CAST_CHECK_IDS: Record<string, number> = {
  'a cozy christmas quilt': 1131992,
  'christmas lovers anonymous': 883901,
};

const APPROVED_DIRECT_IDS: Record<string, number> = {
  'chasing christmas': 1553895,
  'a christmas blessing': 1142044,
  'let it snow': 240906,
  'destined 2 christmas once more': 1137856,
};

function normalise(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function releaseYear(value?: string): number | undefined {
  const year = value?.match(/^((?:19|20)\d{2})/)?.[1];
  return year ? Number(year) : undefined;
}

async function main() {
  const apiKey = requireTmdbApiKey();
  const discovery = JSON.parse(await fs.readFile(discoveryPath, 'utf8')) as {
    entries: Array<{ title: string; year?: number; sourceUrl: string }>;
  };
  const sourceByTitle = new Map(discovery.entries.map((entry) => [normalise(entry.title), entry]));
  const results: Array<Record<string, unknown>> = [];

  for (const gafTitle of PENDING_TITLES) {
    const source = sourceByTitle.get(normalise(gafTitle)) || (gafTitle === 'A Christmas Prayer II' ? sourceByTitle.get(normalise('A Christmas Prayer Tradition')) : undefined);
    const year = source?.year;
    const queries = [gafTitle, ...(ALTERNATE_TITLES[normalise(gafTitle)] || [])];
    const candidates = new Map<number, { id: number; title: string; releaseDate?: string; query: string }>();
    for (const query of queries) {
      for (const match of await searchTmdbMovies(query, undefined, apiKey)) {
        candidates.set(match.id, { ...match, query });
      }
    }

    const candidateList = [...candidates.values()];
    const exact = candidateList.filter((candidate) => queries.some((query) => normalise(query) === normalise(candidate.title)));
    const yearExact = exact.filter((candidate) => !year || releaseYear(candidate.releaseDate) === year);
    const explicitId = gafTitle === 'Pencil Me In For Christmas' ? 1129782 : APPROVED_DIRECT_IDS[normalise(gafTitle)];
    const knownExplicit = explicitId && candidateList.some((candidate) => candidate.id === explicitId)
      ? candidateList.filter((candidate) => candidate.id === explicitId)
      : [];
    const castChecked = APPROVED_CAST_CHECK_IDS[normalise(gafTitle)]
      ? candidateList.filter((candidate) => candidate.id === APPROVED_CAST_CHECK_IDS[normalise(gafTitle)])
      : [];
    const confident = knownExplicit.length === 1
      ? knownExplicit[0]
      : castChecked.length === 1
        ? castChecked[0]
      : yearExact.length === 1
        ? yearExact[0]
        : undefined;
    let confidenceReason = 'no confident TMDB match';
    if (knownExplicit.length === 1) confidenceReason = gafTitle === 'Pencil Me In For Christmas'
      ? 'explicit approved alternate-title mapping: Creating Christmas'
      : 'direct TMDB identity confirmed by requested cast/crew/overview comparison';
    else if (castChecked.length === 1) confidenceReason = 'exact TMDB title plus matching official GAF cast; GAF year label differs from TMDB release year';
    else if (yearExact.length === 1 && normalise(yearExact[0].title) === normalise(gafTitle)) confidenceReason = 'unique exact title and release year';
    else if (yearExact.length === 1) confidenceReason = `unique alternate title and release year via ${yearExact[0].query}`;
    else if (exact.length > 1) confidenceReason = 'multiple exact/alternate TMDB title matches';
    else if (candidateList.length > 0) confidenceReason = 'TMDB candidates did not establish an exact title/year match';

    let castCheck: string | undefined;
    if (confident) {
      const metadata = await fetchTmdbMovie(confident.id, apiKey);
      castCheck = metadata?.cast?.slice(0, 5).map((member) => member.name).join(', ');
    }
    const result = {
      gafTitle,
      gafYear: year,
      sourceUrl: source?.sourceUrl,
      tmdbTitle: confident?.title,
      tmdbId: confident?.id,
      releaseYear: releaseYear(confident?.releaseDate),
      confidence: confident ? 'confident' : exact.length > 1 ? 'ambiguous' : 'unresolved',
      reason: confidenceReason,
      castSample: castCheck,
      candidates: candidateList.map((candidate) => ({ id: candidate.id, title: candidate.title, releaseDate: candidate.releaseDate, query: candidate.query })),
    };
    results.push(result);
    console.log(`${gafTitle} | ${confident?.title || '-'} | ${confident?.id || '-'} | ${releaseYear(confident?.releaseDate) || '-'} | ${result.confidence} | ${confidenceReason}`);
  }

  await writeFileAtomically(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), pending: results.filter((result) => result.confidence !== 'confident'), results }, null, 2));
}

main().catch((error) => {
  console.error(`[GAF Pending Audit] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
