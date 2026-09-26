import type { Actor, Brand, Movie } from '../types';
import type { ActorFilmographyItem, MovieDetailMovie } from '../api/types';
import { getBrandById } from '../data/brands';
import { SITE_ORIGIN, getActorPath, getFeedsPath, getMoviePath, getMoviesPath, getNetworkPath, getYearPath, toCanonicalUrl } from './urls';

export interface SeoDocument {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  ogType?: 'website' | 'article';
  noIndex?: boolean;
  schema?: Record<string, unknown> | Record<string, unknown>[];
}

function absoluteUrl(value?: string): string | undefined {
  if (!value) return undefined;
  return value.startsWith('http') ? value : `${SITE_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function truncateDescription(value: string, maxLength = 160): string {
  const clean = cleanText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
}

function breadcrumbList(items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toCanonicalUrl(item.path),
    })),
  };
}

function withBreadcrumbs(schema: Record<string, unknown>, items: Array<{ name: string; path: string }>): Record<string, unknown>[] {
  return [schema, breadcrumbList(items)];
}

export function buildHomeSeo(totalMovies?: number): SeoDocument {
  const description = totalMovies
    ? `Browse ${totalMovies} Christmas movies from Hallmark, Lifetime, GAF, UPtv and other holiday networks on XmasDB, with cast, release details and movie feeds.`
    : 'Browse Christmas movies from Hallmark, Lifetime, GAF, UPtv and other holiday networks on XmasDB, with cast, release details and movie feeds.';
  return {
    title: 'XmasDB - Christmas Movie Database | Hallmark, Lifetime, GAF & UPtv',
    description,
    canonicalPath: '/',
    image: '/logo-1100.webp',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'XmasDB',
      url: `${SITE_ORIGIN}/`,
      description,
    },
  };
}

export function buildMoviesSeo(totalMovies?: number): SeoDocument {
  return {
    title: 'Christmas Movie Database - Hallmark, Lifetime, GAF & UPtv Movies | XmasDB',
    description: totalMovies
      ? `Browse ${totalMovies} Christmas movies in the XmasDB catalogue, including Hallmark, Lifetime, GAF, UPtv and other holiday network collections.`
      : 'Browse the XmasDB catalogue of Christmas movies, including Hallmark, Lifetime, GAF, UPtv and other holiday network collections.',
    canonicalPath: getMoviesPath(),
    image: '/logo-1100.webp',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Christmas Movie Database',
      url: toCanonicalUrl(getMoviesPath()),
    },
  };
}

export function buildBrandSeo(brand: Brand, year?: number | null, movieCount?: number): SeoDocument {
  const networkName = brand.id === 'gaf'
    ? 'Great American Family Christmas Movies'
    : `${brand.shortName} Christmas Movies`;
  const name = year ? `${networkName} ${year}` : networkName;
  const description = year
    ? `Browse ${movieCount ?? ''}${movieCount !== undefined ? ' ' : ''}${networkName} from ${year} in the XmasDB collection.`
    : `Browse the XmasDB collection of ${networkName}, with movies, cast and release details.`;
  const path = getNetworkPath(brand.slug, year);
  return {
    title: `${name} - ${year ? 'Complete List' : 'Complete Movie List'} | XmasDB`,
    description: cleanText(description),
    canonicalPath: path,
    image: '/logo-1100.webp',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name,
      url: toCanonicalUrl(path),
      description: cleanText(description),
    },
  };
}

export function buildYearSeo(year: number, movieCount?: number): SeoDocument {
  const description = `Browse ${movieCount ?? ''}${movieCount !== undefined ? ' ' : ''}Christmas movies from ${year} in the XmasDB archive.`;
  return {
    title: `Christmas Movies from ${year} | XmasDB`,
    description: cleanText(description),
    canonicalPath: getYearPath(year),
    image: '/logo-1100.webp',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Christmas Movies from ${year}`,
      url: toCanonicalUrl(getYearPath(year)),
      description: cleanText(description),
    },
  };
}

export function buildMovieSeo(movie: Movie | MovieDetailMovie): SeoDocument {
  const brandName = getBrandById(movie.brandId)?.shortName;
  const castNames = movie.cast.slice(0, 3).map((member) => member.name).join(', ');
  const facts = [
    `${movie.title} (${movie.year})`,
    brandName,
    castNames ? `starring ${castNames}` : undefined,
    movie.synopsis,
  ].filter(Boolean).join('. ');
  const canonicalPath = getMoviePath(movie.tmdbId, movie.slug);
  const sameAs = [movie.links?.tmdb, movie.links?.imdb].filter((value): value is string => Boolean(value));
  const detailMovie = 'writingCredits' in movie ? movie : undefined;
  const director = detailMovie?.directorCredit || (movie.director ? { name: movie.director } : undefined);
  const movieSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    url: toCanonicalUrl(canonicalPath),
    description: cleanText(movie.synopsis),
    image: absoluteUrl(movie.posterUrl),
    datePublished: movie.releaseDate || undefined,
    director: director ? {
      '@type': 'Person',
      name: director.name,
      ...('tmdbPersonId' in director ? { url: toCanonicalUrl(getActorPath(director.tmdbPersonId, director.slug)) } : {}),
    } : undefined,
    author: detailMovie?.writingCredits.length ? detailMovie.writingCredits.map((writer) => ({
      '@type': 'Person',
      name: writer.name,
      url: toCanonicalUrl(getActorPath(writer.tmdbPersonId, writer.slug)),
    })) : undefined,
    actor: movie.cast.map((member) => ({
      '@type': 'Person',
      name: member.name,
      url: member.tmdbPersonId ? toCanonicalUrl(getActorPath(member.tmdbPersonId, member.slug)) : undefined,
    })),
    sameAs: sameAs.length ? sameAs : undefined,
  };
  return {
    title: `${movie.title} (${movie.year}) | XmasDB`,
    description: truncateDescription(facts),
    canonicalPath,
    image: movie.posterUrl,
    ogType: 'article',
    schema: withBreadcrumbs(movieSchema, [
      { name: 'Home', path: '/' },
      { name: 'Movies', path: getMoviesPath() },
      { name: movie.title, path: canonicalPath },
    ]),
  };
}

export function buildActorSeo(actor: Actor, filmography: ActorFilmographyItem[] | Movie[] = [], titleDisambiguator?: string): SeoDocument {
  const count = filmography.length;
  const creditFilmography = filmography as ActorFilmographyItem[];
  const brands = [...new Set(filmography.map((movie) => getBrandById(movie.brandId)?.shortName || movie.brandId))].join(', ');
  const biography = actor.biography ? ` ${truncateDescription(actor.biography, 100)}` : '';
  const description = `${actor.name} has ${count} Christmas ${count === 1 ? 'movie' : 'movies'} in the XmasDB filmography${brands ? ` across ${brands}` : ''}. Explore roles, release years and movie details.${biography}`;
  const canonicalPath = getActorPath(actor.tmdbPersonId, actor.slug);
  const sameAs = [
    actor.imdbPersonId ? `https://www.imdb.com/name/${actor.imdbPersonId}/` : undefined,
    actor.tmdbPersonId ? `https://www.themoviedb.org/person/${actor.tmdbPersonId}` : undefined,
  ].filter((value): value is string => Boolean(value));
  const personSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: actor.name,
    url: toCanonicalUrl(canonicalPath),
    image: absoluteUrl(actor.profileUrl || actor.photoUrl),
    description: actor.biography ? truncateDescription(actor.biography, 300) : undefined,
    birthDate: actor.birthday || undefined,
    deathDate: actor.deathday || undefined,
    jobTitle: [...new Set(creditFilmography.flatMap((movie) => [
      ...(movie.character !== undefined ? ['Actor'] : []),
      ...(movie.crewJobs?.includes('Director') ? ['Director'] : []),
      ...(movie.crewJobs?.some((job) => ['Writer', 'Screenplay', 'Story'].includes(job)) ? ['Writer'] : []),
    ]))].join(', ') || undefined,
    sameAs,
  };
  return {
    title: `${actor.name} Christmas Movies - Movies & Filmography${titleDisambiguator ? ` (${titleDisambiguator})` : ''} | XmasDB`,
    description: truncateDescription(description),
    canonicalPath,
    image: actor.profileUrl || actor.photoUrl,
    schema: withBreadcrumbs(personSchema, [
      { name: 'Home', path: '/' },
      { name: 'Movies', path: getMoviesPath() },
      { name: actor.name, path: canonicalPath },
    ]),
  };
}

export function buildFeedsSeo(): SeoDocument {
  const description = 'Curated Christmas movie JSON feeds for Radarr, including Hallmark, Lifetime, GAF and UPtv, for easy import into your Christmas movie library.';
  const faqQuestion = 'Does this work with NZBGet or SABnzbd?';
  const faqAnswer = 'XmasDB feeds are added to Radarr. Radarr then uses the download client configured in your self-hosted media setup, such as NZBGet or SABnzbd. XmasDB does not communicate directly with either client; completed movies can then be organized in Plex or Jellyfin.';
  return {
    title: 'Christmas Movie Feeds for Radarr | XmasDB',
    description,
    canonicalPath: getFeedsPath(),
    image: '/logo-1100.webp',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Christmas Movie Feeds for Radarr',
        url: toCanonicalUrl(getFeedsPath()),
        description,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [{
          '@type': 'Question',
          name: faqQuestion,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faqAnswer,
          },
        }],
      },
    ],
  };
}

export function buildAboutSeo(): SeoDocument {
  const description = 'Why XmasDB exists: a personal, curated Christmas movie database with Hallmark, Lifetime, Great American Family, and UPtv movies, actor browsing and Radarr-compatible JSON feeds.';
  return {
    title: 'About XmasDB - Why I Built the Christmas Movie Database | XmasDB',
    description,
    canonicalPath: '/about/',
    image: '/logo-1100.webp',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'Why XmasDB Exists',
      url: toCanonicalUrl('/about/'),
      description,
    },
  };
}

export function buildPrivacySeo(): SeoDocument {
  const description = 'Learn how XmasDB handles privacy, data and the use of AI in building this independent Christmas movie database.';
  return {
    title: 'Privacy & AI | XmasDB',
    description,
    canonicalPath: '/privacy/',
    image: '/logo-1100.webp',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Privacy & AI',
      url: toCanonicalUrl('/privacy/'),
      description,
    },
  };
}

export function buildContactSeo(): SeoDocument {
  const description = 'Send a correction, report a missing Christmas movie or get in touch with XmasDB.';
  return {
    title: 'Contact XmasDB | Corrections & Missing Movies',
    description,
    canonicalPath: '/contact/',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Contact XmasDB',
      url: toCanonicalUrl('/contact/'),
      description,
    },
  };
}

export function buildApiSeo(): SeoDocument {
  return {
    title: 'XmasDB API - Christmas Movie Data for Developers',
    description: 'Use the free read-only XmasDB API to access curated Christmas movie, actor, network and Christmas Ingredient data.',
    canonicalPath: '/api/',
  };
}

export function buildNotFoundSeo(): SeoDocument {
  return {
    title: 'Page Not Found | XmasDB',
    description: 'The Christmas movie page you are looking for could not be found on XmasDB.',
    noIndex: true,
  };
}

function setMeta(document: Document, selector: string, attribute: string, value: string | undefined): void {
  let element = document.querySelector<HTMLMetaElement>(selector);
  if (!value) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, selector.includes('[property=') ? selector.match(/property="([^"]+)/)?.[1] || '' : selector.match(/name="([^"]+)/)?.[1] || '');
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

export function updateSeoTags(seo: SeoDocument): void {
  if (typeof document === 'undefined') return;
  const canonical = seo.canonicalPath ? toCanonicalUrl(seo.canonicalPath) : undefined;
  document.title = seo.title;
  setMeta(document, 'meta[name="description"]', 'name', seo.description);
  setMeta(document, 'meta[name="robots"]', 'name', seo.noIndex ? 'noindex,follow' : 'index,follow');
  setMeta(document, 'meta[property="og:type"]', 'property', seo.ogType || 'website');
  setMeta(document, 'meta[property="og:site_name"]', 'property', 'XmasDB');
  setMeta(document, 'meta[property="og:title"]', 'property', seo.title);
  setMeta(document, 'meta[property="og:description"]', 'property', seo.description);
  setMeta(document, 'meta[property="og:url"]', 'property', canonical);
  setMeta(document, 'meta[property="og:image"]', 'property', absoluteUrl(seo.image));
  setMeta(document, 'meta[name="twitter:card"]', 'name', 'summary_large_image');
  setMeta(document, 'meta[name="twitter:title"]', 'name', seo.title);
  setMeta(document, 'meta[name="twitter:description"]', 'name', seo.description);
  setMeta(document, 'meta[name="twitter:image"]', 'name', absoluteUrl(seo.image));

  let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) canonicalLink?.remove();
  else {
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;
  }

  let schema = document.getElementById('schema-json-ld');
  if (!schema) {
    schema = document.createElement('script');
    schema.id = 'schema-json-ld';
    schema.setAttribute('type', 'application/ld+json');
    document.head.appendChild(schema);
  }
  schema.textContent = seo.schema ? JSON.stringify(seo.schema) : '';
}
