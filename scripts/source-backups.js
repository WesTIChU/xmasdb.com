import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_FILES = ['movies.json', 'upcoming.json', 'cast.json', 'person-cache.json'];

export function createSourceBackups(rootDir = ROOT, suffix = '.before-tmdb-refresh') {
  const backups = [];
  for (const file of SOURCE_FILES) {
    const source = path.join(rootDir, file);
    const backup = path.join(rootDir, `${file}${suffix}`);
    if (!fs.existsSync(source) || fs.existsSync(backup)) continue;
    fs.copyFileSync(source, backup, fs.constants.COPYFILE_EXCL);
    backups.push(backup);
  }
  return backups;
}

export { SOURCE_FILES };
