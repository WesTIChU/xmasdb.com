import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSourceBackups, SOURCE_FILES } from './source-backups.js';

test('source backups are created once and never overwritten', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xmasdb-backups-'));
  for (const file of SOURCE_FILES) await writeFile(path.join(root, file), `${file}:original`);
  const created = createSourceBackups(root);
  assert.equal(created.length, SOURCE_FILES.length);
  for (const file of SOURCE_FILES) assert.equal(await readFile(path.join(root, `${file}.before-tmdb-refresh`), 'utf8'), `${file}:original`);
  await writeFile(path.join(root, 'movies.json'), 'movies:changed');
  assert.deepEqual(createSourceBackups(root), []);
  assert.equal(await readFile(path.join(root, 'movies.json.before-tmdb-refresh'), 'utf8'), 'movies.json:original');
});
