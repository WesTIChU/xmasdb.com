import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { buildCatalogueMeta } from '../src/server/catalogue-api';
import {
  ContactRateLimiter,
  ensureContactStorage,
  getContactSubmissionsPath,
  storeContactSubmission,
  validateContactSubmission,
} from '../src/server/contact';

const movieCount = String(buildCatalogueMeta().totalMovies);
const valid = (overrides: Record<string, unknown> = {}) => ({
  type: 'missing-movie',
  title: 'A Christmas Test',
  message: 'Please consider adding this movie.',
  name: '',
  email: '',
  spamCheck: movieCount,
  website: '',
  ...overrides,
});

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-contact-'));
const submissionsPath = getContactSubmissionsPath(tempDir);
await ensureContactStorage(tempDir);
assert.deepEqual(JSON.parse(await fs.readFile(submissionsPath, 'utf8')), [], 'missing JSON file is initialized safely');

const validResult = validateContactSubmission(valid());
assert.equal(validResult.ok, true, 'current movie count allows a valid submission');
if (!validResult.ok) throw new Error('valid test submission was rejected');
assert.match(validResult.submission.id, /^[0-9a-f-]{36}$/);
assert.match(validResult.submission.createdAt, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(validResult.submission.status, 'new');
assert.equal(validResult.submission.movieTitle, 'A Christmas Test');
await storeContactSubmission(validResult.submission, tempDir);

let stored = JSON.parse(await fs.readFile(submissionsPath, 'utf8')) as Array<Record<string, unknown>>;
assert.equal(stored.length, 1, 'valid submission is persisted');
assert.deepEqual(Object.keys(stored[0]).sort(), ['createdAt', 'id', 'message', 'movieTitle', 'status', 'type']);

const rejectedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-contact-rejected-'));
await ensureContactStorage(rejectedDir);
assert.equal(validateContactSubmission(valid({ spamCheck: '1' })).ok, false, 'incorrect movie count stores nothing');
assert.equal(validateContactSubmission(valid({ website: 'bot' })).ok, false, 'honeypot submission stores nothing');
assert.deepEqual(JSON.parse(await fs.readFile(getContactSubmissionsPath(rejectedDir), 'utf8')), []);

assert.equal(validateContactSubmission(valid({ message: '' })).ok, false, 'message is required');
assert.equal(validateContactSubmission(valid({ type: 'missing-movie', title: '' })).ok, false, 'missing movie requires a title');
assert.equal(validateContactSubmission(valid({ type: 'correction', title: '' })).ok, false, 'correction requires a title');
assert.equal(validateContactSubmission(valid({ type: 'other', title: '' })).ok, true, 'other submissions may omit a title');
assert.equal(validateContactSubmission(valid({ email: '' })).ok, true, 'email may be blank');
assert.equal(validateContactSubmission(valid({ email: 'not-an-email' })).ok, false, 'invalid email is rejected');
assert.equal(validateContactSubmission(valid({ name: 'x'.repeat(101) })).ok, false, 'name limit is enforced');
assert.equal(validateContactSubmission(valid({ email: 'x'.repeat(250) + '@x.com' })).ok, false, 'email limit is enforced');
assert.equal(validateContactSubmission(valid({ title: 'x'.repeat(201) })).ok, false, 'movie title limit is enforced');
assert.equal(validateContactSubmission(valid({ message: 'x'.repeat(3001) })).ok, false, 'message limit is enforced');

const concurrentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-contact-concurrent-'));
await ensureContactStorage(concurrentDir);
const concurrentResults = Array.from({ length: 20 }, (_, index) => validateContactSubmission(valid({ title: `Movie ${index}` })));
assert.ok(concurrentResults.every((result) => result.ok));
await Promise.all(concurrentResults.map((result) => storeContactSubmission(result.ok ? result.submission : validResult.submission, concurrentDir)));
stored = JSON.parse(await fs.readFile(getContactSubmissionsPath(concurrentDir), 'utf8'));
assert.equal(stored.length, 20, 'concurrent submissions are serialized without overwriting');
assert.equal(new Set(stored.map((submission) => String(submission.id))).size, 20, 'stored IDs are unique');

const malformedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-contact-malformed-'));
const malformedPath = getContactSubmissionsPath(malformedDir);
await fs.mkdir(malformedDir, { recursive: true });
await fs.writeFile(malformedPath, '{not valid json', 'utf8');
await ensureContactStorage(malformedDir);
assert.equal(await fs.readFile(malformedPath, 'utf8'), '{not valid json', 'malformed JSON is preserved');
await assert.rejects(() => storeContactSubmission(validResult.submission, malformedDir));

const limiter = new ContactRateLimiter();
for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(limiter.allow('test-ip', 1000), true);
assert.equal(limiter.allow('test-ip', 1000), false, 'contact rate limit applies after five submissions');
assert.equal(limiter.allow('other-ip', 1000), true, 'rate limit is isolated per IP');
assert.equal(limiter.allow('test-ip', 1000 + 15 * 60 * 1000), true, 'rate limit expires after fifteen minutes');

assert.equal(buildCatalogueMeta().totalMovies, MOVIES.length, 'contact validation uses the canonical catalogue total');
console.log('Contact persistence, validation, atomic writes, honeypot, and rate-limit tests passed.');
