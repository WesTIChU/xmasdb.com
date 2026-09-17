import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

const read = file => fs.readFileSync(path.join(DIST, file), 'utf8');
const extractStylesheets = html => html.match(/<link rel="stylesheet"[^>]+>/g) || [];
const extractModulePreload = html => {
  const match = html.match(/<link rel="modulepreload"[^>]+href="([^"]*site-layout[^"]*)"[^>]*>/);
  if (!match) throw new Error('Could not find the hashed site-layout bundle in Vite output.');
  return `<script type="module" crossorigin src="${match[1]}"></script>`;
};
const extractEntryScript = html => {
  const match = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
  if (!match) throw new Error('Could not find a Vite application entry bundle.');
  return match[0];
};
const extractBody = html => html.match(/<body>([\s\S]*)<\/body>/)?.[1] || '';

const indexTemplate = read('index.html');
const movieTemplate = read('movie.html');
const actorTemplate = read('actor.html');
const sharedStyles = extractStylesheets(indexTemplate);
const siteLayoutScript = extractModulePreload(movieTemplate);
const pageStyles = {
  movie: extractStylesheets(movieTemplate).filter(tag => tag.includes('movie-')),
  actor: extractStylesheets(actorTemplate).filter(tag => tag.includes('actor-')),
};
const appScripts = { movie: extractEntryScript(movieTemplate), actor: extractEntryScript(actorTemplate) };

function matchValue(html, expression) {
  return html.match(expression)?.[1] || '';
}

function movieBody(seoHtml) {
  const body = extractBody(movieTemplate);
  const title = matchValue(seoHtml, /<h1 class="detail-title">([\s\S]*?)<\/h1>/);
  const poster = matchValue(seoHtml, /<img class="detail-poster"[^>]+src="([^"]+)"/);
  const overview = matchValue(seoHtml, /<p class="detail-overview">([\s\S]*?)<\/p>/);
  const year = matchValue(seoHtml, /<span class="detail-badge detail-badge-year">([\s\S]*?)<\/span>/);
  const rating = matchValue(seoHtml, /<span class="detail-badge detail-badge-rating">([\s\S]*?)<\/span>/);
  const status = matchValue(seoHtml, /<span class="detail-badge detail-badge-upcoming">([\s\S]*?)<\/span>/);
  const cast = matchValue(seoHtml, /<ul class="static-cast-list">([\s\S]*?)<\/ul>/);
  const castLinks = cast.replace(/<li>([\s\S]*?)<\/li>/g, '<span>$1</span>');
  const breadcrumb = `<nav class="breadcrumbs" aria-label="Breadcrumb" style="display:none"><a href="/">Home</a> <span aria-hidden="true">&gt;</span> <a href="/year/${year}">${year || 'Movies'}</a> <span aria-hidden="true">&gt;</span> <span>${title}</span></nav>`;

  return body
    .replace('<a href="/" class="back-link" id="back-link">&larr; Back to Movies</a>', `<a href="/" class="back-link" id="back-link">&larr; Back to Movies</a>${breadcrumb}`)
    .replace('<h1 id="detail-title" class="detail-title">Title</h1>', `<h1 id="detail-title" class="detail-title">${title}</h1>`)
    .replace('<img id="detail-poster" class="detail-poster" src="" alt="Movie Poster" />', `<img id="detail-poster" class="detail-poster" src="${poster}" alt="${title} movie poster" />`)
    .replace('<span id="detail-year" class="detail-badge detail-badge-year"></span>', `<span id="detail-year" class="detail-badge detail-badge-year">${year}</span>`)
    .replace('<span id="detail-status" class="detail-badge detail-badge-upcoming" style="display: none;">UPCOMING</span>', `<span id="detail-status" class="detail-badge detail-badge-upcoming"${status ? '' : ' style="display: none;"'}>${status || 'UPCOMING'}</span>`)
    .replace('<span id="detail-rating" class="detail-badge detail-badge-rating"></span>', `<span id="detail-rating" class="detail-badge detail-badge-rating">${rating}</span>`)
    .replace('<p id="detail-overview" class="detail-overview"></p>', `<p id="detail-overview" class="detail-overview">${overview}</p>`)
    .replace('<div id="cast-grid" class="cast-grid"></div>', `<div id="cast-grid" class="cast-grid"><div class="seo-initial-cast">${castLinks}</div></div>`);
}

function actorBody(seoHtml) {
  const body = extractBody(actorTemplate);
  const name = matchValue(seoHtml, /<h1 class="actor-name">([\s\S]*?)<\/h1>/);
  const photo = matchValue(seoHtml, /<img class="actor-profile-photo"[^>]+src="([^"]+)"/);
  const filmography = matchValue(seoHtml, /<ul class="static-filmography-list">([\s\S]*?)<\/ul>/);

  return body
    .replace('<h1 id="actor-name" class="actor-name">Actor Name</h1>', `<h1 id="actor-name" class="actor-name">${name}</h1>`)
    .replace('<img id="actor-profile-photo" class="actor-profile-photo" src="" alt="Actor Photo" />', `<img id="actor-profile-photo" class="actor-profile-photo" src="${photo}" alt="${name} profile photo" />`)
    .replace('<div id="actor-filmography-grid" class="actor-filmography-grid">\n            <!-- Movie cards dynamically generated -->\n          </div>', `<div id="actor-filmography-grid" class="actor-filmography-grid"><div class="seo-initial-filmography">${filmography}</div></div>`);
}

function inject(file, kind) {
  let html = fs.readFileSync(file, 'utf8');
  if (kind === 'movie') html = html.replace(/<body>[\s\S]*<\/body>/, `<body>${movieBody(html)}</body>`);
  if (kind === 'actor') html = html.replace(/<body>[\s\S]*<\/body>/, `<body>${actorBody(html)}</body>`);
  html = html.replace(/<link rel="stylesheet"[^>]+>\s*/g, '');
  html = html.replace(/<script type="module" crossorigin src="\/assets\/site-layout-[^"]+"><\/script>\s*/g, '');
  html = html.replace(/<script type="module" src="\/(?:snow\.js|movie\.js|actor\.js|js\/site-layout\.js)"><\/script>\s*/g, '');
  html = html.replace('</head>', `${[...sharedStyles, ...(pageStyles[kind] || [])].join('')}\n</head>`);
  const script = appScripts[kind] || siteLayoutScript;
  html = html.replace('</body>', `${script}\n</body>`);
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
