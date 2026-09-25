import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ADMIN_SESSION_TTL_MS,
  AdminAuth,
  AdminLoginRateLimiter,
  isAdminConfigured,
  isSameOriginMutation,
  cookieOptions,
} from '../src/server/admin-auth';
import {
  ensureContactStorage,
  getContactSubmissionsPath,
  readContactSubmissions,
  updateContactSubmissions,
} from '../src/server/contact';

const auth = new AdminAuth({ password: 'correct-password', secret: 'test-session-secret' });
assert.equal(isAdminConfigured({ password: '', secret: 'secret' }), false, 'missing password disables admin auth');
assert.equal(isAdminConfigured({ password: 'password', secret: '' }), false, 'missing session secret disables admin auth');
assert.equal(auth.verifyPassword('wrong-password'), false, 'incorrect password fails');
assert.equal(auth.verifyPassword('correct-password'), true, 'correct password succeeds');

const cookie = auth.createCookie(1000);
assert.equal(cookie.includes('correct-password'), false, 'session cookie does not contain the password');
assert.equal(auth.authenticate(cookie, 1000 + ADMIN_SESSION_TTL_MS - 1), true, 'session is valid before expiry');
assert.equal(auth.authenticate(cookie, 1000 + ADMIN_SESSION_TTL_MS), false, 'session expires');
assert.equal(ADMIN_SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000, 'session lifetime is seven days');
assert.match(cookieOptions(false), /Max-Age=604800/, 'development cookie has a seven-day lifetime');
assert.match(cookieOptions(false), /HttpOnly/, 'admin cookie is HttpOnly');
assert.match(cookieOptions(false), /SameSite=Lax/, 'admin cookie uses SameSite=Lax');
assert.doesNotMatch(cookieOptions(false), /Secure/, 'development cookie does not require Secure');
assert.match(cookieOptions(true), /Secure/, 'production cookie is Secure');
const activeCookie = auth.createCookie();
assert.equal(auth.authenticate(activeCookie), true);
auth.revoke(activeCookie);
assert.equal(auth.authenticate(activeCookie), false, 'logout revokes the session');

const navigationFlowCookie = auth.createCookie(2000);
for (const path of ['/api/admin/submissions', '/', '/admin/', '/admin/feed-statistics/', '/', '/admin/feed-statistics/']) {
  assert.equal(auth.authenticate(navigationFlowCookie, 2000 + 1), true, `session survives navigation through ${path}`);
}

const limiter = new AdminLoginRateLimiter();
for (let attempt = 0; attempt < 5; attempt += 1) {
  assert.equal(limiter.allow('admin-ip', 1000), true);
  limiter.recordFailure('admin-ip', 1000);
}
assert.equal(limiter.allow('admin-ip', 1000), false, 'admin login rate limiting applies after five failures');
assert.equal(limiter.allow('other-ip', 1000), true, 'admin login limits are isolated by IP');

const request = (origin?: string) => ({
  headers: origin ? { origin, host: 'xmasdb.test' } : { host: 'xmasdb.test' },
  protocol: 'https',
  get: (name: string) => name.toLowerCase() === 'host' ? 'xmasdb.test' : undefined,
});
assert.equal(isSameOriginMutation(request('https://xmasdb.test')), true);
assert.equal(isSameOriginMutation(request('https://attacker.test')), false, 'cross-origin mutations are rejected');

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-admin-'));
await ensureContactStorage(tempDir);
const submission = {
  id: 'admin-test-submission',
  createdAt: '2026-09-20T14:30:00.000Z',
  status: 'new' as const,
  type: 'other' as const,
  movieTitle: 'Test Movie',
  message: 'Test message',
};
await updateContactSubmissions(() => [submission], tempDir);
await updateContactSubmissions((items) => items.map((item) => ({ ...item, status: 'resolved' as const })), tempDir);
assert.equal((await readContactSubmissions(tempDir))[0].status, 'resolved', 'resolved status persists');
await updateContactSubmissions((items) => items.map((item) => ({ ...item, status: 'new' as const })), tempDir);
assert.equal((await readContactSubmissions(tempDir))[0].status, 'new', 'new status persists');
await updateContactSubmissions((items) => items.filter((item) => item.id !== submission.id), tempDir);
assert.deepEqual(await readContactSubmissions(tempDir), [], 'deletion persists');
assert.equal(await fs.readFile(getContactSubmissionsPath(tempDir), 'utf8'), '[]\n');

console.log('Admin authentication, sessions, CSRF checks, rate limits, and storage mutations passed.');
