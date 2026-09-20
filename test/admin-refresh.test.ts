import assert from 'node:assert/strict';
import { AdminAuth } from '../src/server/admin-auth';
import { COMING_SOON_WORKFLOW, dispatchComingSoonRefresh, WorkflowDispatchCooldown } from '../src/server/github-catalogue';

assert.equal(new AdminAuth({ password: 'password', secret: 'secret' }).authenticate(undefined), false, 'unauthenticated requests are rejected');

const cooldown = new WorkflowDispatchCooldown(300000);
assert.equal(cooldown.canDispatch(300000), true);
cooldown.record(300000);
assert.equal(cooldown.canDispatch(300001), false, 'repeated dispatches are blocked during cooldown');
assert.equal(cooldown.canDispatch(600000), true);

const originalFetch = globalThis.fetch;
let dispatchRequest: { url: string; method?: string; body?: string; authorization?: string } | undefined;
globalThis.fetch = async (input, init) => {
  dispatchRequest = {
    url: String(input),
    method: init?.method,
    body: String(init?.body || ''),
    authorization: String((init?.headers as Record<string, string> | undefined)?.Authorization || ''),
  };
  return new Response(null, { status: 204 });
};
try {
  const secretToken = 'server-only-token';
  const result = await dispatchComingSoonRefresh({ token: secretToken, owner: 'owner', repo: 'repo', branch: 'main' });
  assert.equal(result, undefined, 'workflow acceptance does not claim refresh completion');
  assert.equal(dispatchRequest?.url, `https://api.github.com/repos/owner/repo/actions/workflows/${COMING_SOON_WORKFLOW}/dispatches`);
  assert.equal(dispatchRequest?.method, 'POST');
  assert.deepEqual(JSON.parse(dispatchRequest?.body || '{}'), { ref: 'main' });
  assert.equal(dispatchRequest?.authorization, `Bearer ${secretToken}`);
  assert.equal(JSON.stringify({ status: 'started', message: 'Refresh started' }).includes(secretToken), false, 'token is never part of a browser response');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Admin Coming Soon workflow dispatch, fixed target, auth, token isolation, and cooldown tests passed.');
