import assert from 'node:assert/strict';
import { buildJevKeywordClassifierInput, getJevKeywordClassifierPrompt, MockJevKeywordClassifier, normalizeJevKeyword, validateJevKeywordResult } from '../src/server/jev-keywords';

const synopsis = 'Annie, a lawyer, must save her family cafe from demolition. She works with a real estate developer.';
const input = { synopsis, existingKeywords: ['Café'] };
const prompt = getJevKeywordClassifierPrompt();
assert.match(prompt, /Do not stop after finding one strong keyword/);
assert.match(prompt, /Multiple concepts from the same sentence are allowed/);
assert.match(prompt, /occupations and professions/);
assert.match(prompt, /central goals or problems/);
function hasRejectedProposal(raw: unknown, testInput: typeof input): boolean {
  const validation = validateJevKeywordResult(raw, testInput);
  return validation.ok && validation.rejected.length > 0;
}
assert.equal(validateJevKeywordResult({ newKeywords: [{ keyword: 'lawyer', evidence: 'a lawyer', reason: 'The synopsis identifies Annie as a lawyer.' }] }, input).ok, true);
const multiple = validateJevKeywordResult({ newKeywords: [
  { keyword: 'lawyer', evidence: 'a lawyer', reason: 'Occupation.' },
  { keyword: 'restaurant', evidence: 'family cafe', reason: 'Central venue.' },
  { keyword: 'family business', evidence: 'family cafe', reason: 'Explicit family-owned business.' },
  { keyword: 'demolition', evidence: 'demolition', reason: 'Central plot problem.' },
] }, { synopsis, existingKeywords: [] });
assert.equal(multiple.ok, true);
if (multiple.ok) assert.deepEqual(multiple.result.newKeywords.map((keyword) => keyword.keyword), ['lawyer', 'restaurant', 'family business', 'demolition'], 'multiple independently useful concepts are accepted together');
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'cafe', evidence: 'family cafe', reason: 'The synopsis identifies a cafe.' }] }, input), true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'LAWYER', evidence: 'a lawyer', reason: 'Duplicate.' }] }, { synopsis, existingKeywords: ['lawyer'] }), true);
assert.equal(normalizeJevKeyword('Café'), normalizeJevKeyword('cafe'));
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'lawyer', evidence: 'a lawyer', reason: 'First.' }, { keyword: 'LAWYERS', evidence: 'a lawyer', reason: 'Duplicate.' }] }, { synopsis, existingKeywords: [] }), true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'demolition', evidence: 'a restaurant', reason: 'Wrong evidence.' }] }, input), true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: '   ', evidence: 'a lawyer', reason: 'Empty.' }] }, input), true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'school', evidence: 'high school crush', reason: 'Substring mistake.' }] }, { synopsis: 'Their high school crush returns.', existingKeywords: [] }), true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'magic', evidence: 'work their magic', reason: 'Substring mistake.' }] }, { synopsis: 'They work their magic.', existingKeywords: [] }), true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'estate', evidence: 'real estate developer', reason: 'Substring mistake.' }] }, { synopsis: 'A real estate developer arrives.', existingKeywords: [] }), true);
assert.equal(validateJevKeywordResult({ newKeywords: [] }, input).ok, true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'romance', evidence: 'love', reason: 'Genre.' }] }, { synopsis: 'They fall in love.', existingKeywords: [] }), true);
assert.equal(validateJevKeywordResult({ newKeywords: [], removeKeywords: ['cafe'] }, input).ok, false);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'rink', evidence: 'public skating rink', reason: 'Too broad.' }] }, { synopsis: 'She runs the public skating rink.', existingKeywords: [] }), true);
assert.equal(validateJevKeywordResult({ newKeywords: [{ keyword: 'skating rink', evidence: 'public skating rink', reason: 'Specific place.' }] }, { synopsis: 'She runs the public skating rink.', existingKeywords: [] }).ok, true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'market', evidence: 'Christmas market', reason: 'Too broad.' }] }, { synopsis: 'She visits the Heidelberg Christmas market.', existingKeywords: [] }), true);
assert.equal(validateJevKeywordResult({ newKeywords: [{ keyword: 'Christmas market', evidence: 'Christmas market', reason: 'Specific event.' }] }, { synopsis: 'She visits the Heidelberg Christmas market.', existingKeywords: [] }).ok, true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'chocolate', evidence: 'hot chocolate', reason: 'Too broad.' }] }, { synopsis: 'She makes hot chocolate.', existingKeywords: [] }), true);
assert.equal(validateJevKeywordResult({ newKeywords: [{ keyword: 'hot chocolate', evidence: 'hot chocolate', reason: 'Specific food.' }] }, { synopsis: 'She makes hot chocolate.', existingKeywords: [] }).ok, true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'producer', evidence: 'producer', reason: 'Too generic.' }] }, { synopsis: 'She is a television producer.', existingKeywords: [] }), true);
assert.equal(validateJevKeywordResult({ newKeywords: [{ keyword: 'television producer', evidence: 'television producer', reason: 'Specific domain role.' }] }, { synopsis: 'She is a television producer.', existingKeywords: [] }).ok, true);
assert.equal(validateJevKeywordResult({ newKeywords: [{ keyword: 'surgeon', evidence: 'overworked surgeon', reason: 'Meaningful occupation.' }] }, { synopsis: 'An overworked surgeon returns home.', existingKeywords: [] }).ok, true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'overworked surgeon', evidence: 'overworked surgeon', reason: 'Descriptive qualifier.' }] }, { synopsis: 'An overworked surgeon returns home.', existingKeywords: [] }), true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'pose', evidence: 'pose as his girlfriend', reason: 'Action fragment.' }] }, { synopsis: 'She will pose as his girlfriend.', existingKeywords: [] }), true);
assert.equal(validateJevKeywordResult({ newKeywords: [{ keyword: 'fake relationship', evidence: 'pose as his girlfriend', reason: 'The synopsis establishes a pretend relationship.' }] }, { synopsis: 'She will pose as his girlfriend.', existingKeywords: [] }).ok, true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'hand-painted', evidence: 'hand-painted ornaments', reason: 'Modifier fragment.' }] }, { synopsis: 'She sells hand-painted ornaments.', existingKeywords: [] }), true);
assert.equal(validateJevKeywordResult({ newKeywords: [{ keyword: 'ornaments', evidence: 'hand-painted ornaments', reason: 'Concrete object.' }] }, { synopsis: 'She sells hand-painted ornaments.', existingKeywords: [] }).ok, true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'heir', evidence: 'the heir to the firm', reason: 'Incidental role.' }] }, { synopsis: 'The heir to the firm arrives.', existingKeywords: [] }), true);
assert.equal(hasRejectedProposal({ newKeywords: [{ keyword: 'girlfriend', evidence: 'his girlfriend', reason: 'Incidental relationship noun.' }] }, { synopsis: 'She pretends to be his girlfriend.', existingKeywords: [] }), true);
assert.equal(validateJevKeywordResult({ newKeywords: [
  { keyword: 'holiday season', evidence: 'holiday season', reason: 'Boilerplate.' },
  { keyword: 'loved ones', evidence: 'loved ones', reason: 'Generic relationship.' },
  { keyword: 'week', evidence: 'the week', reason: 'Generic duration.' },
  { keyword: 'mistakes', evidence: 'mistakes', reason: 'Incidental circumstance.' },
  { keyword: 'father', evidence: 'father', reason: 'Incidental relationship.' },
] }, { synopsis: 'She helps her loved ones during the holiday season for the week after mistakes involving her father.', existingKeywords: [] }).ok, true, 'generic boilerplate response remains structurally valid');
const boilerplate = validateJevKeywordResult({ newKeywords: [
  { keyword: 'holiday season', evidence: 'holiday season', reason: 'Boilerplate.' },
  { keyword: 'loved ones', evidence: 'loved ones', reason: 'Generic relationship.' },
  { keyword: 'week', evidence: 'the week', reason: 'Generic duration.' },
  { keyword: 'mistakes', evidence: 'mistakes', reason: 'Incidental circumstance.' },
  { keyword: 'father', evidence: 'father', reason: 'Incidental relationship.' },
] }, { synopsis: 'She helps her loved ones during the holiday season for the week after mistakes involving her father.', existingKeywords: [] });
if (boilerplate.ok) assert.equal(boilerplate.result.newKeywords.length, 0, 'generic and incidental concepts remain rejected');
assert.deepEqual(await new MockJevKeywordClassifier({ newKeywords: [] }).classifyMovie(input), { newKeywords: [] });
const inputShape = buildJevKeywordClassifierInput({ id: 'test', slug: 'test', title: 'Test', year: 2020, brandId: 'hallmark', releaseDate: '2020-01-01', synopsis, posterUrl: '', cast: [], tmdbId: 1, keywords: [], fingerprints: ['some-ingredient'] });
assert.deepEqual(Object.keys(inputShape).sort(), ['existingKeywords', 'synopsis']);
assert.equal(Object.prototype.hasOwnProperty.call({ newKeywords: [] }, 'fingerprints'), false);
console.log('Jev Keywords validation tests passed.');
