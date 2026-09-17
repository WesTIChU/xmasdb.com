import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

const read = file => fs.readFileSync(path.join(DIST, file), 'utf8');
const extractStylesheets = html => html.match(/<link rel="stylesheet"[^>]+>/g) || [];
const extractSiteLayout = html => {
  const match = html.match(/<link rel="modulepreload"[^>]+href="([^"]*site-layout[^"]*)"[^>]*>/);
  if (!match) throw new Error('Could not find the hashed site-layout bundle in Vite output.');
  return `<script type="module" crossorigin src="${match[1]}"></script>`;
};

const sharedStyles = extractStylesheets(read('index.html'));
const siteLayoutScript = extractSiteLayout(read('movie.html'));
const pageStyles = {
  movie: extractStylesheets(read('movie.html')).filter(tag => tag.includes('movie-')),
  actor: extractStylesheets(read('actor.html')).filter(tag => tag.includes('actor-')),
};

function inject(file, kind) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<link rel="stylesheet"[^>]+>\s*/g, '');
  html = html.replace(/<script type="module" crossorigin src="\/assets\/site-layout-[^"]+"><\/script>\s*/g, '');
  html = html.replace(/<script type="module" src="\/snow\.js"><\/script>\s*<script type="module" src="\/js\/site-layout\.js"><\/script>/g, '');
  html = html.replace('</head>', `${[...sharedStyles, ...(pageStyles[kind] || [])].join('')}\n</head>`);
  html = html.replace('</body>', `${siteLayoutScript}\n</body>`);
  fs.writeFileSync(file, html, 'utf8');
}

function visit(directory, kind) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file, kind);
    else if (entry.name === 'index.html') inject(file, kind);
  }
}

for (const [directory, kind] of [['movie', 'movie'], ['actor', 'actor'], ['year', null], ['actors', null]]) {
  const target = path.join(DIST, directory);
  if (fs.existsSync(target)) visit(target, kind || 'year');
}

console.log('SEO assets injected from Vite output.');
