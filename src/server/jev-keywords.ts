import type { Movie } from '../types';
import { normalizeJevKeyword } from '../utils/keyword-identity';
export { normalizeJevKeyword } from '../utils/keyword-identity';

export interface JevKeywordClassifierInput {
  synopsis: string;
  existingKeywords: string[];
}

export interface JevKeywordProposal {
  keyword: string;
  evidence: string;
  reason: string;
}

export interface ValidatedJevKeywordResult {
  newKeywords: JevKeywordProposal[];
}

export interface JevKeywordClassifier {
  classifyMovie(input: JevKeywordClassifierInput): Promise<unknown>;
}

export interface JevKeywordCandidate {
  keyword: string;
  evidence: string;
}

const LOW_VALUE_KEYWORDS = new Set([
  'movie', 'movies', 'romance', 'romantic', 'comedy', 'drama', 'television', 'tv', 'film',
  'christmas', 'christmas movie', 'holiday', 'man', 'woman', 'friend', 'friends', 'family', 'relationship', 'love', 'life', 'town', 'work',
  'magic', 'competition', 'travel', 'christmas traditions',
]);

const PHRASE_FRAGMENT_EXCLUSIONS: Record<string, RegExp[]> = {
  school: [/\bhigh school crush\b/i],
  magic: [/\bwork(?:s|ed)? their magic\b/i],
  estate: [/\breal estate developer\b/i],
  travel: [/\btravels? home\b/i],
};

const USEFUL_SINGLE_KEYWORDS = new Set([
  'lawyer', 'veterinarian', 'architect', 'florist', 'journalist', 'teacher', 'chef', 'baker', 'photographer',
  'surgeon', 'doctor', 'reporter', 'producer', 'realtor', 'screenwriter', 'artist', 'restaurant', 'cafe',
  'hotel', 'ranch', 'demolition', 'adoption', 'inheritance', 'ornament', 'gift', 'recipe', 'hockey',
  'wedding', 'parade', 'fundraiser', 'eviction',
]);
const LOW_USEFULNESS_PHRASES = new Set(['hand painted', 'overworked surgeon', 'beloved grandmother']);
const INCIDENTAL_RELATIONSHIP_PHRASES = new Set(['ex boyfriend', 'boyfriend', 'girlfriend', 'husband', 'wife', 'parent', 'son', 'daughter', 'mentor']);
const MEANINGFUL_QUALIFIER_OVERRIDES: Record<string, RegExp[]> = {
  producer: [/\btelevision producer\b/i],
};

function normalizeEvidence(value: string): string {
  return value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

function evidenceIsInSynopsis(evidence: string, synopsis: string): boolean {
  const normalizedEvidence = normalizeEvidence(evidence);
  return Boolean(normalizedEvidence) && normalizeEvidence(synopsis).includes(normalizedEvidence);
}

const CANDIDATE_STOPWORDS = new Set('a an and are as at be by for from her his in into is it its of on or she that the their them they this to was with when who you your'.split(' '));
const CONCRETE_CANDIDATE_PATTERNS: Array<{ keyword: string; pattern: RegExp }> = [
  { keyword: 'lawyer', pattern: /\blawyer\b/i }, { keyword: 'veterinarian', pattern: /\bveterinarian\b/i },
  { keyword: 'architect', pattern: /\barchitect\b/i }, { keyword: 'florist', pattern: /\bflorist\b/i },
  { keyword: 'journalist', pattern: /\bjournalist\b/i }, { keyword: 'teacher', pattern: /\bteacher\b/i },
  { keyword: 'chef', pattern: /\bchef\b/i }, { keyword: 'baker', pattern: /\bbaker\b/i },
  { keyword: 'photographer', pattern: /\bphotographer\b/i }, { keyword: 'surgeon', pattern: /\bsurgeon\b/i },
  { keyword: 'doctor', pattern: /\bdoctor\b/i }, { keyword: 'reporter', pattern: /\breporter\b/i },
  { keyword: 'television producer', pattern: /\btelevision producer\b/i }, { keyword: 'producer', pattern: /\bproducer\b/i }, { keyword: 'realtor', pattern: /\brealtor\b/i },
  { keyword: 'screenwriter', pattern: /\bscreenwriter\b/i }, { keyword: 'artist', pattern: /\bartist\b/i },
  { keyword: 'restaurant', pattern: /\brestaurant\b/i }, { keyword: 'cafe', pattern: /\bcaf[eé]\b/i },
  { keyword: 'coffee shop', pattern: /\bcoffee shop\b/i }, { keyword: 'dessert shop', pattern: /\bdessert shop\b/i },
  { keyword: 'hotel', pattern: /\bhotel\b/i }, { keyword: 'ranch', pattern: /\branch\b/i },
  { keyword: 'development firm', pattern: /\bdevelopment firm\b/i }, { keyword: 'skating rink', pattern: /\b(?:public|indoor) skating rink\b/i },
  { keyword: 'figure skating', pattern: /\bfigure skating\b/i }, { keyword: 'Christmas market', pattern: /\b(?:[A-Z][\p{L}'’-]+ )?Christmas market\b/iu },
  { keyword: 'hot chocolate', pattern: /\bhot chocolate\b/i }, { keyword: 'fake relationship', pattern: /\bpose as [^,.!?]+\b/i },
  { keyword: 'hockey player', pattern: /\bhockey player\b/i }, { keyword: 'single dad', pattern: /\bsingle dad\b/i }, { keyword: 'wedding', pattern: /\bwedding\b/i },
  { keyword: 'parade', pattern: /\bparade\b/i }, { keyword: 'demolition', pattern: /\bdemolition\b/i },
  { keyword: 'adoption', pattern: /\badoption\b/i }, { keyword: 'inheritance', pattern: /\binheritance\b/i },
  { keyword: 'eviction notice', pattern: /\beviction notice\b/i },
  { keyword: 'family business', pattern: /\bfamily(?:'s|’s)?\s+(?:restaurant|business|shop|store)\b/i },
];

function buildTextCandidates(synopsis: string): JevKeywordCandidate[] {
  const tokens = [...synopsis.matchAll(/[\p{L}][\p{L}'’\-]*/gu)].map((match) => ({ value: match[0], start: match.index || 0, end: (match.index || 0) + match[0].length }));
  const candidates: JevKeywordCandidate[] = [];
  for (let index = 0; index < tokens.length && candidates.length < 140; index += 1) {
    for (let length = 1; length <= 3 && index + length <= tokens.length && candidates.length < 140; length += 1) {
      const group = tokens.slice(index, index + length);
      if (length !== 1) continue;
      const meaningful = group.filter((token) => !CANDIDATE_STOPWORDS.has(token.value.toLowerCase()) && token.value.length >= 4);
      if (group.some((token) => /^[A-Z]/.test(token.value))) continue;
      if (!meaningful.length) continue;
      const keyword = group.map((token) => token.value.replace(/[’']s$/i, '')).join(' ').trim();
      const normalized = normalizeJevKeyword(keyword);
      if (!normalized || LOW_VALUE_KEYWORDS.has(normalized) || candidates.some((candidate) => normalizeJevKeyword(candidate.keyword) === normalized)) continue;
      candidates.push({ keyword, evidence: synopsis.slice(group[0].start, group[group.length - 1].end) });
    }
  }
  return candidates;
}

export function buildJevKeywordCandidates(input: JevKeywordClassifierInput): JevKeywordCandidate[] {
  const candidates = buildTextCandidates(input.synopsis);
  for (const { keyword, pattern } of CONCRETE_CANDIDATE_PATTERNS) {
    if (input.existingKeywords.some((existing) => normalizeJevKeyword(existing) === normalizeJevKeyword(keyword))) continue;
    const match = input.synopsis.match(pattern);
    if (!match || candidates.some((candidate) => normalizeJevKeyword(candidate.keyword) === normalizeJevKeyword(keyword))) continue;
    candidates.push({ keyword, evidence: match[0] });
  }
  const filtered = candidates.filter((candidate) => !input.existingKeywords.some((existing) => normalizeJevKeyword(existing) === normalizeJevKeyword(candidate.keyword)));
  return filtered.filter((candidate, index) => {
    const candidateTokens = normalizeJevKeyword(candidate.keyword).split(' ');
    return !filtered.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      const otherTokens = normalizeJevKeyword(other.keyword).split(' ');
      if (otherTokens.length <= candidateTokens.length) return false;
      return otherTokens.some((_token, start) => otherTokens.slice(start, start + candidateTokens.length).join(' ') === candidateTokens.join(' '));
    });
  });
}

export function buildJevKeywordClassifierInput(movie: Movie): JevKeywordClassifierInput {
  return {
    synopsis: movie.synopsis.trim(),
    existingKeywords: (movie.keywords || []).map((keyword) => keyword.name.trim()).filter(Boolean),
  };
}

export function getJevKeywordClassifierPrompt(): string {
  return [
    'You are Jev Keywords, a conservative factual extraction tool for XmasDB.',
    'Use only the supplied synopsis. Do not browse, use IMDb, use outside knowledge, or infer facts from the title or genre.',
    'Find useful, concrete factual story concepts explicitly stated or unambiguously established by the synopsis.',
    'Before selecting a concept, ask: would a user click this keyword to browse other Christmas movies sharing this concept? If not, reject it.',
    'Prefer the most specific meaningful searchable concept supported by the synopsis, not a literal fragment: television producer becomes television producer (not producer), public skating rink becomes skating rink (not rink), Christmas market becomes Christmas market (not market), and hot chocolate becomes hot chocolate (not chocolate).',
    'Preserve a qualifier only when it identifies the type or domain of the concept. Discard merely descriptive or emotional qualifiers: overworked surgeon becomes surgeon, beloved grandmother becomes grandmother, and hand-painted ornaments becomes ornaments.',
    'Reject incidental role or relationship nouns and action fragments when they are not useful discovery concepts: heir, girlfriend, pose, closing, market, rink, chocolate, and hand-painted should not stand alone.',
    'Return only concepts that are not already represented by the supplied existing keywords.',
    'Treat capitalization, punctuation, accents, and trivial singular/plural differences as matches.',
    'Words inside phrases are not automatically separate concepts: high school crush is not school, real estate developer is not estate, work their magic is not magic, and travels home is not travel.',
    'Do not simply reproduce genres or generic terms such as movie, romance, comedy, drama, man, woman, family, relationship, love, life, town, or work.',
    'The application supplies candidate concepts with supporting synopsis phrases. Decide each candidate independently and conservatively.',
    'Be conservative. Candidates that are names, generic terms, genres, phrase fragments, or merely plausible should be false. No selected candidate means an empty newKeywords result.',
    'There is no deletion, rejection, replacement, or existing-keyword decision.',
  ].join('\n');
}

export function validateJevKeywordResult(raw: unknown, input: JevKeywordClassifierInput): { ok: true; result: ValidatedJevKeywordResult; rejected: string[] } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Jev Keywords response must be an object.' };
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).length !== 1 || !Object.prototype.hasOwnProperty.call(value, 'newKeywords')) return { ok: false, error: 'Jev Keywords response must contain only newKeywords.' };
  if (!Array.isArray(value.newKeywords)) return { ok: false, error: 'newKeywords must be an array.' };

  const existing = new Set(input.existingKeywords.map(normalizeJevKeyword));
  const proposed = new Set<string>();
  const newKeywords: JevKeywordProposal[] = [];
  const rejected: string[] = [];
  const reject = (error: string): void => { rejected.push(error); };
  for (const rawProposal of value.newKeywords) {
    if (!rawProposal || typeof rawProposal !== 'object' || Array.isArray(rawProposal)) { reject('Each proposal must be an object.'); continue; }
    const proposal = rawProposal as Record<string, unknown>;
    if (Object.keys(proposal).length !== 3 || !['keyword', 'evidence', 'reason'].every((key) => Object.prototype.hasOwnProperty.call(proposal, key))) { reject('Each proposal must contain only keyword, evidence, and reason.'); continue; }
    if (typeof proposal.keyword !== 'string' || !proposal.keyword.trim()) { reject('Keyword must be non-empty.'); continue; }
    if (typeof proposal.evidence !== 'string' || !proposal.evidence.trim()) { reject(`Evidence is missing for ${proposal.keyword}.`); continue; }
    if (typeof proposal.reason !== 'string' || !proposal.reason.trim()) { reject(`Reason is missing for ${proposal.keyword}.`); continue; }
    const normalizedKeyword = normalizeJevKeyword(proposal.keyword);
    if (!normalizedKeyword) { reject('Keyword normalizes to empty.'); continue; }
    if (LOW_VALUE_KEYWORDS.has(normalizedKeyword)) { reject(`Low-value or generic keyword rejected: ${proposal.keyword}.`); continue; }
    if (LOW_USEFULNESS_PHRASES.has(normalizedKeyword)) { reject(`Low-usefulness descriptive phrase rejected: ${proposal.keyword}.`); continue; }
    if (INCIDENTAL_RELATIONSHIP_PHRASES.has(normalizedKeyword)) { reject(`Incidental role or relationship rejected: ${proposal.keyword}.`); continue; }
    if (MEANINGFUL_QUALIFIER_OVERRIDES[normalizedKeyword]?.some((pattern) => pattern.test(input.synopsis))) { reject(`Generic keyword superseded by a meaningful qualifier: ${proposal.keyword}.`); continue; }
    if (normalizedKeyword.split(' ').length === 1 && !USEFUL_SINGLE_KEYWORDS.has(normalizedKeyword)) { reject(`Incidental or insufficiently specific keyword rejected: ${proposal.keyword}.`); continue; }
    if (PHRASE_FRAGMENT_EXCLUSIONS[normalizedKeyword]?.some((pattern) => pattern.test(String(proposal.evidence)) || pattern.test(input.synopsis))) { reject(`Keyword is only a fragment of a non-keyword phrase: ${proposal.keyword}.`); continue; }
    if (existing.has(normalizedKeyword)) { reject(`Existing keyword duplicated: ${proposal.keyword}.`); continue; }
    if (proposed.has(normalizedKeyword)) { reject(`Duplicate Jev keyword: ${proposal.keyword}.`); continue; }
    if (!evidenceIsInSynopsis(proposal.evidence, input.synopsis)) { reject(`Evidence is not present in the synopsis for ${proposal.keyword}.`); continue; }
    proposed.add(normalizedKeyword);
    newKeywords.push({ keyword: proposal.keyword.trim(), evidence: proposal.evidence.trim(), reason: proposal.reason.trim() });
  }
  return { ok: true, result: { newKeywords }, rejected };
}

export interface OpenRouterJevKeywordClassifierOptions { apiKey?: string; model?: string; baseUrl?: string }

/** OpenRouter JSON classifier for Jev Keywords only. It has no catalogue or persistence access. */
export class OpenRouterJevKeywordClassifier implements JevKeywordClassifier {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  lastUsage: unknown;

  constructor(options: OpenRouterJevKeywordClassifierOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.model = options.model || process.env.OPENROUTER_MODEL || '';
    this.baseUrl = (options.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api').replace(/\/$/, '');
    if (!this.apiKey) throw new Error('Missing OPENROUTER_API_KEY. No Jev Keywords request was made.');
    if (!this.model) throw new Error('Missing OPENROUTER_MODEL. No Jev Keywords request was made.');
  }

  get configuredModel(): string { return this.model; }

  async classifyMovie(input: JevKeywordClassifierInput): Promise<unknown> {
    const candidates = buildJevKeywordCandidates(input);
    const questions = Object.fromEntries(candidates.map((candidate, index) => [`candidate_${index}`, {
      type: 'noul',
      instructions: `Is “${candidate.keyword}” a useful, specific, searchable story concept that a user would click to browse other Christmas movies, explicitly stated or unambiguously established by the synopsis, rather than a generic term, genre, incidental noun, or fragment of a phrase?${candidate.keyword === 'family business' ? ' A family restaurant or family shop is sufficient evidence for the family business concept.' : ''}${candidate.keyword === 'cafe' ? ' A specifically named café is a useful searchable setting.' : ''}`,
      criteria: {
        true: `The synopsis supports ${candidate.keyword} as a useful concept and it is not already covered by the existing keywords.`,
        false: `The synopsis does not support ${candidate.keyword}, the concept is generic or a genre, it is only a phrase fragment, or an existing keyword already covers it.`,
      },
    }]));
    if (candidates.length === 0) return { newKeywords: [] };
    const response = await fetch(`${this.baseUrl}/alpha/decisions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
        ...(process.env.OPENROUTER_APP_NAME ? { 'X-Title': process.env.OPENROUTER_APP_NAME } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        state: { synopsis: input.synopsis, existingKeywords: input.existingKeywords, candidateConcepts: candidates },
        instructions: getJevKeywordClassifierPrompt(),
        questions,
      }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Jev Keywords HTTP ${response.status}: ${body.slice(0, 500)}`);
    let envelope: unknown;
    try { envelope = JSON.parse(body); } catch { throw new Error('Jev Keywords returned invalid API JSON.'); }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('Jev Keywords returned an invalid API envelope.');
    this.lastUsage = (envelope as { usage?: unknown }).usage;
    const answers = (envelope as { answers?: Record<string, { noul?: unknown }> }).answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Jev Keywords response did not contain typed answers.');
    const threshold = Number(process.env.OPENROUTER_JEV_KEYWORD_THRESHOLD || '0.6');
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('OPENROUTER_JEV_KEYWORD_THRESHOLD must be between 0 and 1.');
    return {
      newKeywords: candidates.filter((_candidate, index) => {
        const answer = answers[`candidate_${index}`];
        return answer && typeof answer.noul === 'number' && answer.noul >= threshold;
      }).map((candidate) => ({ keyword: candidate.keyword, evidence: candidate.evidence, reason: `The synopsis explicitly states or unambiguously establishes this concept: “${candidate.evidence}”.` })),
    };
  }
}

export class MockJevKeywordClassifier implements JevKeywordClassifier {
  constructor(private readonly result: unknown = { newKeywords: [] }) {}
  async classifyMovie(_input: JevKeywordClassifierInput): Promise<unknown> { return this.result; }
}
