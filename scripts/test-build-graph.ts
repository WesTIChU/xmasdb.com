import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve('dist');
const html = await readFile(resolve(dist, 'index.html'), 'utf8');

if (/catalogue-data[^"']*\.js/.test(html)) {
  throw new Error('Homepage preload graph contains the full catalogue-data chunk.');
}

const scripts = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.js)"/g)].map((match) => match[1]);
const javascript = (await Promise.all(scripts.map((asset) => readFile(resolve(dist, asset.slice(1)), 'utf8')))).join('\n');

if (/catalogue-data|evidence/.test(javascript)) {
  throw new Error('Homepage JavaScript contains catalogue data or internal Jev evidence.');
}

console.log(`Build graph OK: ${scripts.length} initial JavaScript assets; no catalogue data or Jev evidence.`);
