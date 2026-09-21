import assert from 'node:assert/strict';
import test from 'node:test';
import { getGoatCounterPagePath, isGoatCounterRouteAllowed } from '../src/utils/analytics';

test('GoatCounter paths preserve the canonical route and query string', () => {
  assert.equal(getGoatCounterPagePath('/movie/123/example/', '?from=home'), '/movie/123/example/?from=home');
  assert.equal(getGoatCounterPagePath('/', ''), '/');
});

test('GoatCounter excludes admin routes but allows public routes', () => {
  assert.equal(isGoatCounterRouteAllowed('admin-login'), false);
  assert.equal(isGoatCounterRouteAllowed('admin-submissions'), false);
  assert.equal(isGoatCounterRouteAllowed('not-found', '/admin/unknown/'), false);
  assert.equal(isGoatCounterRouteAllowed('home'), true);
  assert.equal(isGoatCounterRouteAllowed('movie'), true);
  assert.equal(isGoatCounterRouteAllowed('not-found'), true);
});
