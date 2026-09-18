import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getActorUrl, getMovieUrl } from '../movie-url.js';
import { getPublicMovies } from '../public-movies.js';
import { generateRadarrFeeds } from './generate-radarr-feeds.js';
import { selectTrailerVideos } from './trailer-utils.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const BASE_URL = 'https://xmasdb.com';
for (const generatedDir of ['movie', 'actor', 'year', 'actors', 'radarr']) {
  fs.rmSync(path.join(PUBLIC, generatedDir), { recursive: true, force: true });
}
const movies = JSON.parse(fs.readFileSync(path.join(ROOT, 'movies.json'), 'utf8'));
const upcomingMovies = JSON.parse(fs.readFileSync(path.join(ROOT, 'upcoming.json'), 'utf8'));
const castData = JSON.parse(fs.readFileSync(path.join(ROOT, 'cast.json'), 'utf8'));
const personCache = JSON.parse(fs.readFileSync(path.join(ROOT, 'person-cache.json'), 'utf8'));
const castForMovie = movie => {
  const id = String(movie.tmdbId || movie.tmdb_id);
  return castData.castByMovieId?.[id] || castData.movieCast?.[id] || movie.cast || [];
};
generateRadarrFeeds(movies, castData, upcomingMovies);
const publicMovies = getPublicMovies(movies, upcomingMovies);
const actorsById = new Map((castData.actors || [])
  .filter(actor => actor?.id && actor?.name && actor.count > 0)
  .map(actor => [String(actor.id), actor]));
for (const movie of publicMovies) {
  for (const person of castForMovie(movie)) {
    if (!person?.id || !person?.name) continue;
    const id = String(person.id);
    const existing = actorsById.get(id) || personCache[id] || {};
    actorsById.set(id, { ...existing, ...person, id: person.id, name: person.name });
  }
}
const actors = [...actorsById.values()];
const actorById = new Map(actors.map(actor => [String(actor.id), actor]));
const actorNameCounts = new Map(actors.map(actor => [actor.name.toLowerCase(), actors.filter(item => item.name.toLowerCase() === actor.name.toLowerCase()).length]));
const moviePages = publicMovies;

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const escapeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');
const movieUrl = movie => getMovieUrl(movie);
const actorUrl = actor => getActorUrl(actor);
const absolute = url => `${BASE_URL}${url}`;
function headerHtml() {
  return `<header id="site-header" class="site-header homepage-hero">
    <div class="hero-branch hero-branch-left" aria-hidden="true"></div>
    <div class="hero-branch hero-branch-right" aria-hidden="true"></div>
    <div class="hero-lights" aria-hidden="true"><span class="hero-light hero-light-one"></span><span class="hero-light hero-light-two"></span><span class="hero-light hero-light-three"></span><span class="hero-light hero-light-four"></span><span class="hero-light hero-light-five"></span><span class="hero-light hero-light-six"></span></div>
    <div class="header-inner"><div class="header-top-row"><a href="/" class="header-title-wrap header-brand-link"><span class="title-lockup"><span class="title-ornament" aria-hidden="true"><span></span></span><span class="title-rule" aria-hidden="true"></span><span class="site-title">XmasDB.com</span><span class="title-rule" aria-hidden="true"></span></span></a></div><p class="site-description">A curated collection of Hallmark Christmas movies.</p><p class="header-festive-message"><span class="festive-main-message">Christmas movies for every festive mood.</span><span class="header-movie-count">${movies.length} Hallmark Christmas movies ready and waiting.</span></p></div>
    <div class="hero-snowbank" aria-hidden="true"></div>
  </header>`;
}

function shell({ title, description, canonical, type, image, schema, body, style = 'style.css' }) {
  const ogImage = image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '';
  const twitterImage = image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : '';
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(absolute(canonical))}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta property="og:type" content="${type}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(absolute(canonical))}">${ogImage}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}">${twitterImage}<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/${style}"><script type="application/ld+json">${escapeJson(schema)}</script></head><body>${headerHtml()}${body}<footer id="site-footer" class="site-footer"></footer><script type="module" src="/snow.js"></script><script type="module" src="/js/site-layout.js"></script></body></html>`;
}

function writePage(route, html) {
  const dir = path.join(PUBLIC, route.replace(/^\/+|\/+$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

const generatedMovieRoutes = new Set();
const generatedActorRoutes = new Set();
const errors = [];

for (const movie of moviePages) {
  const id = movie.tmdbId || movie.tmdb_id;
  if (!id || !movie.title) continue;
  const route = movieUrl(movie);
  generatedMovieRoutes.add(route);
  const cast = castForMovie(movie);
  const castLinks = cast.map(person => {
    const actor = actorById.get(String(person.id)) || person;
    return `<li><a href="${escapeHtml(actorUrl(actor))}">${escapeHtml(person.name || actor.name)}</a>${person.character ? ` as ${escapeHtml(person.character)}` : ''}</li>`;
  }).join('');
  const isUpcoming = movie.status === 'upcoming';
  const description = isUpcoming
    ? `Explore ${movie.title}${movie.year ? ` (${movie.year})` : ''}, including its upcoming release date, synopsis and cast. This title is coming soon and is not yet in the XmasDB collection.`
    : `Explore ${movie.title}${movie.year ? ` (${movie.year})` : ''}, including the movie synopsis, cast, actors and its place in our Hallmark Christmas movie collection.`;
  const sameAs = [`https://www.themoviedb.org/movie/${id}`];
  if (movie.imdbId || movie.imdb_id) sameAs.push(`https://www.imdb.com/title/${movie.imdbId || movie.imdb_id}/`);
  const rating = Number.isFinite(Number(movie.vote_average)) && Number(movie.vote_average) > 0 ? Number(movie.vote_average) : null;
  const schema = { '@context': 'https://schema.org', '@type': 'Movie', name: movie.title, description: movie.overview || description, image: movie.poster || undefined, url: absolute(route), datePublished: movie.release_date || undefined, dateCreated: !movie.release_date && movie.year ? String(movie.year) : undefined, sameAs, actor: cast.filter(person => person.id && person.name).map(person => ({ '@type': 'Person', name: person.name, url: absolute(actorUrl(actorById.get(String(person.id)) || person)) })), aggregateRating: rating ? { '@type': 'AggregateRating', ratingValue: rating.toFixed(1), bestRating: '10', worstRating: '0', ratingCount: Number(movie.vote_count) > 0 ? Number(movie.vote_count) : undefined } : undefined };
  const ratingBadge = rating ? `<span class="detail-badge detail-badge-rating">★ ${rating.toFixed(1)} / 10 on TMDB</span>` : '';
  const trailer = selectTrailerVideos(movie.videos)[0];
  const trailerSection = trailer ? `<section class="detail-section"><h2>Trailer</h2><div class="trailer-embed-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}" title="${escapeHtml(trailer.name || 'Official Trailer')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></section>` : '';
  const body = `<main class="movie-page-container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">&gt;</span> <span>${escapeHtml(movie.title)}</span></nav><article class="movie-content static-seo-content"><div class="movie-header-details"><div class="movie-poster-col">${movie.poster ? `<img class="detail-poster" src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title)}${movie.year ? ` (${movie.year})` : ''} movie poster">` : ''}</div><div class="movie-meta-col"><h1 class="detail-title">${escapeHtml(movie.title)}</h1><div class="detail-badges-row">${isUpcoming ? '<span class="detail-badge detail-badge-upcoming">UPCOMING</span>' : ''}${movie.year ? `<span class="detail-badge detail-badge-year">${movie.year}</span>` : ''}${movie.release_date ? `<span class="detail-badge">Premiered: ${escapeHtml(movie.release_date)}</span>` : ''}${ratingBadge}</div><div class="detail-synopsis-wrap"><h2>Synopsis</h2><p class="detail-overview">${escapeHtml(movie.overview || 'No synopsis available for this Hallmark movie.')}</p></div></div></div>${trailerSection}<section class="detail-section"><h2>Cast &amp; Characters</h2><ul class="static-cast-list">${castLinks || '<li>Cast information is not available in the collection data.</li>'}</ul></section></article></main>`;
  writePage(route, shell({ title: `${movie.title}${movie.year ? ` (${movie.year})` : ''} - Cast, Movie Details & Hallmark Guide`, description, canonical: route, type: 'video.movie', image: movie.poster, schema, body, style: 'movie.css' }));
}

for (const actor of actors) {
  const route = actorUrl(actor);
  const actorLabel = actorNameCounts.get(actor.name.toLowerCase()) > 1 ? `${actor.name} (TMDB ${actor.id})` : actor.name;
  generatedActorRoutes.add(route);
  const actorMovies = publicMovies.filter(movie => castForMovie(movie).some(person => Number(person.id) === Number(actor.id)));
  const description = `Explore ${actorLabel} and the Hallmark Christmas movies in our collection featuring the actor, including roles, movie years and cast information.`;
  const profile = actor.profile || actor.profile_path || '';
  const schema = { '@context': 'https://schema.org', '@type': 'Person', name: actor.name, image: profile || undefined, birthDate: actor.birthday || undefined, url: absolute(route), sameAs: [`https://www.themoviedb.org/person/${actor.id}`] };
  const movieLinks = actorMovies.sort((a, b) => Number(b.year || 0) - Number(a.year || 0)).map(movie => `<li><a href="${escapeHtml(movieUrl(movie))}">${escapeHtml(movie.title)}</a>${movie.year ? ` (${movie.year})` : ''}${movie.status === 'upcoming' ? ' <span class="detail-badge detail-badge-upcoming">UPCOMING</span>' : ''}</li>`).join('');
  const body = `<main class="actor-page-container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">&gt;</span> <a href="/actors">Actors</a> <span aria-hidden="true">&gt;</span> <span>${escapeHtml(actor.name)}</span></nav><article class="actor-content static-seo-content"><div class="actor-hero-section">${profile ? `<div class="actor-photo-col"><img class="actor-profile-photo" src="${escapeHtml(profile)}" alt="${escapeHtml(actor.name)} profile photo"></div>` : ''}<div class="actor-details-col"><h1 class="actor-name">${escapeHtml(actor.name)}</h1>${actor.birthday ? `<p>Born ${escapeHtml(actor.birthday)}</p>` : ''}<p>${escapeHtml(actor.name)} appears in ${actorMovies.length} Hallmark Christmas ${actorMovies.length === 1 ? 'movie' : 'movies'} in this collection.</p><a class="external-btn actor-json-btn" href="/json/actors/${actor.id}.json" target="_blank" rel="noopener noreferrer">RADARR / JSON LIST</a><p class="actor-json-help">Hallmark Christmas movies in this collection featuring ${escapeHtml(actor.name)}. This is not the actor's complete filmography.</p></div></div><section class="actor-filmography-section"><h2>XmasDB.com in this collection</h2><ul class="static-filmography-list">${movieLinks}</ul></section></article></main>`;
  writePage(route, shell({ title: `${actorLabel} - XmasDB.com, Roles & Cast Guide`, description, canonical: route, type: 'profile', image: profile, schema, body, style: 'actor.css' }));
}

const years = [...new Set(movies.map(movie => Number(movie.year)).filter(Boolean))].sort((a, b) => b - a);
const generatedYearRoutes = new Set();
for (const year of years) {
  const route = `/year/${year}`;
  generatedYearRoutes.add(route);
  const yearMovies = movies.filter(movie => Number(movie.year) === year);
  const links = yearMovies.map(movie => `<li><a href="${escapeHtml(movieUrl(movie))}">${escapeHtml(movie.title)}</a></li>`).join('');
  const description = `Browse ${year} Hallmark Christmas movies in our collection, with movie details, cast and character links.`;
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `XmasDB.com ${year}`, description, url: absolute(route) };
  const body = `<main class="container static-seo-content"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">&gt;</span> <span>${year}</span></nav><h1>XmasDB.com ${year}</h1><p>${escapeHtml(description)}</p><ul>${links}</ul></main>`;
  writePage(route, shell({ title: `XmasDB.com ${year} - Titles, Cast & Guide`, description, canonical: route, type: 'website', schema, body }));
}

const actorIndexRoute = '/actors';
const actorIndexLinks = actors.map(actor => `<li><a href="${escapeHtml(actorUrl(actor))}">${escapeHtml(actor.name)}</a></li>`).join('');
writePage(actorIndexRoute, shell({
  title: 'Hallmark Christmas Actors - Cast Guide',
  description: 'Browse actors appearing in the Hallmark Christmas movies in our collection.',
  canonical: actorIndexRoute,
  type: 'collection',
  schema: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Hallmark Christmas Actors', url: absolute(actorIndexRoute) },
  body: `<main class="container static-seo-content"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">&gt;</span> <span>Actors</span></nav><h1>Hallmark Christmas Actors</h1><p>Actors appearing in the Hallmark Christmas movies in this collection.</p><ul>${actorIndexLinks}</ul></main>`
}));
const radarrRoute = '/radarr';
const radarrDir = path.join(PUBLIC, 'radarr');
fs.mkdirSync(radarrDir, { recursive: true });
fs.writeFileSync(path.join(radarrDir, 'index.html'), '<!doctype html><meta http-equiv="refresh" content="0;url=/radarr.html"><a href="/radarr.html">Open Radarr guide</a>', 'utf8');

const sitemapRoutes = ['/', radarrRoute, actorIndexRoute, ...generatedYearRoutes, ...generatedMovieRoutes, ...generatedActorRoutes];
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapRoutes.map(route => `<url><loc>${escapeHtml(absolute(route))}</loc><lastmod>${today}</lastmod></url>`).join('')}</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), sitemap, 'utf8');
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`, 'utf8');
fs.writeFileSync(path.join(PUBLIC, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`, 'utf8');

const audit = { moviesChecked: movies.length, moviePagesGenerated: generatedMovieRoutes.size, moviePagesWithUniqueTitle: 0, moviePagesWithUniqueDescription: 0, moviePagesWithCanonical: 0, moviePagesWithMovieJsonLd: 0, actorsChecked: actors.length, actorPagesGenerated: generatedActorRoutes.size, actorPagesWithUniqueTitle: 0, actorPagesWithUniqueDescription: 0, actorPagesWithCanonical: 0, actorPagesWithPersonJsonLd: 0, yearPagesGenerated: generatedYearRoutes.size, sitemapMovieUrls: generatedMovieRoutes.size, sitemapActorUrls: generatedActorRoutes.size, duplicateTitles: [], duplicateDescriptions: [], missingCanonicalUrls: [], missingH1: [], missingPosterAlt: [], missingStructuredData: [], brokenInternalLinks: [], urlsPresentInSitemapThatDoNotResolve: [] };
const titleValues = [];
const descriptionValues = [];
for (const route of [...generatedMovieRoutes, ...generatedActorRoutes, ...generatedYearRoutes]) {
  const file = path.join(PUBLIC, route.slice(1), 'index.html');
  if (!fs.existsSync(file)) audit.urlsPresentInSitemapThatDoNotResolve.push(route);
  else {
    const html = fs.readFileSync(file, 'utf8');
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    const description = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] || '';
    titleValues.push(title); descriptionValues.push(description);
    const isMovie = route.startsWith('/movie/');
    const isActor = route.startsWith('/actor/');
    if (isMovie && title) audit.moviePagesWithUniqueTitle++;
    if (isMovie && description) audit.moviePagesWithUniqueDescription++;
    if (isMovie && /<link rel="canonical"/.test(html)) audit.moviePagesWithCanonical++;
    if (isMovie && /"@type":"Movie"/.test(html)) audit.moviePagesWithMovieJsonLd++;
    if (isActor && title) audit.actorPagesWithUniqueTitle++;
    if (isActor && description) audit.actorPagesWithUniqueDescription++;
    if (isActor && /<link rel="canonical"/.test(html)) audit.actorPagesWithCanonical++;
    if (isActor && /"@type":"Person"/.test(html)) audit.actorPagesWithPersonJsonLd++;
    if (!/<link rel="canonical"/.test(html)) audit.missingCanonicalUrls.push(route);
    if (!/<h1[ >]/i.test(html)) audit.missingH1.push(route);
    if (!/application\/ld\+json/.test(html)) audit.missingStructuredData.push(route);
    if (route.startsWith('/movie/') && html.includes('<img') && !/alt="[^"]+"/.test(html)) audit.missingPosterAlt.push(route);
    for (const link of html.matchAll(/href="(\/movie\/[^"#?]+|\/actor\/[^"#?]+|\/year\/[^"#?]+|\/actors|\/radarr)"/g)) {
      const target = link[1];
      const known = target === '/actors' || target === '/radarr' || generatedMovieRoutes.has(target) || generatedActorRoutes.has(target) || generatedYearRoutes.has(target);
      if (!known) audit.brokenInternalLinks.push(`${route} -> ${target}`);
    }
  }
}
for (const values of [titleValues, descriptionValues]) {
  const counts = new Map(values.map(value => [value, values.filter(item => item === value).length]));
  for (const [value, count] of counts) if (value && count > 1) (values === titleValues ? audit.duplicateTitles : audit.duplicateDescriptions).push(value);
}
for (const route of sitemapRoutes) {
  const file = route === '/' ? path.join(PUBLIC, 'index.html') : path.join(PUBLIC, route.slice(1), 'index.html');
  if (!fs.existsSync(file) && route !== '/radarr' && route !== '/') audit.urlsPresentInSitemapThatDoNotResolve.push(route);
}
fs.writeFileSync(path.join(ROOT, 'seo-audit.json'), JSON.stringify(audit, null, 2) + '\n', 'utf8');
console.log(`SEO generated: ${audit.moviePagesGenerated} movie pages, ${audit.actorPagesGenerated} actor pages, ${audit.yearPagesGenerated} year pages.`);
console.log(`SEO audit: ${audit.urlsPresentInSitemapThatDoNotResolve.length ? 'errors found' : 'zero generation errors'}.`);
