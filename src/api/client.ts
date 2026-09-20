import type {
  ActorDetailPayload,
  CatalogueListing,
  CatalogueMeta,
  FeedsMetaPayload,
  HomePayload,
  MovieDetailPayload,
  SearchIndexPayload,
  SearchResultsPayload,
} from './types';

export const ABOUT_URL = '/api/about';
export const PRIVACY_URL = '/api/privacy';
export const CONTACT_URL = '/api/contact';

declare global {
  interface Window {
    __XMASDB_META__?: CatalogueMeta;
    __XMASDB_ROUTE__?: { url?: string; payload?: unknown };
  }
}

/** Thrown when the API returns a non-2xx response. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Cache limit keeps browsing many movie/actor pages from growing without bound. */
const MAX_CACHED_REQUESTS = 96;

const pending = new Map<string, Promise<unknown>>();
const resolved = new Map<string, unknown>();

function remember(url: string, value: unknown) {
  if (resolved.has(url)) resolved.delete(url);
  resolved.set(url, value);
  while (resolved.size > MAX_CACHED_REQUESTS) {
    const oldest = resolved.keys().next().value;
    if (oldest === undefined) break;
    resolved.delete(oldest);
  }
}

if (typeof window !== 'undefined' && window.__XMASDB_ROUTE__?.url && window.__XMASDB_ROUTE__.payload !== undefined) {
  remember(window.__XMASDB_ROUTE__.url, window.__XMASDB_ROUTE__.payload);
}

function request<T>(url: string): Promise<T> {
  if (resolved.has(url)) return Promise.resolve(resolved.get(url) as T);

  const inflight = pending.get(url);
  if (inflight) return inflight as Promise<T>;

  const promise = fetch(url, { headers: { Accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) {
        throw new ApiError(`Request failed with status ${response.status}`, response.status);
      }
      return (await response.json()) as T;
    })
    .then((data) => {
      remember(url, data);
      pending.delete(url);
      return data;
    })
    .catch((error) => {
      pending.delete(url);
      throw error;
    });

  pending.set(url, promise);
  return promise;
}

/** Returns already-resolved data for a URL, enabling synchronous cached renders. */
export function peekResolved<T>(url: string): T | undefined {
  return resolved.get(url) as T | undefined;
}

/** Generic cached GET used by route loaders. */
export function fetchUrl<T>(url: string): Promise<T> {
  return request<T>(url);
}

/** Warms the cache for a URL without surfacing errors. */
export function prefetch(url: string): void {
  request(url).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Metadata (bootstrap-injected in production, fetched as a fallback)
// ---------------------------------------------------------------------------

let metaMemory: CatalogueMeta | null =
  typeof window !== 'undefined' ? window.__XMASDB_META__ ?? null : null;

export const CATALOGUE_META_URL = '/api/meta';

export function getCatalogueMetaSnapshot(): CatalogueMeta | null {
  return metaMemory;
}

export function loadCatalogueMeta(): Promise<CatalogueMeta> {
  if (metaMemory) return Promise.resolve(metaMemory);
  const injected = typeof window !== 'undefined' ? window.__XMASDB_META__ : undefined;
  if (injected) {
    metaMemory = injected;
    remember(CATALOGUE_META_URL, injected);
    return Promise.resolve(injected);
  }
  return request<CatalogueMeta>(CATALOGUE_META_URL).then((meta) => {
    metaMemory = meta;
    return meta;
  });
}

// ---------------------------------------------------------------------------
// Typed endpoints
// ---------------------------------------------------------------------------

export const HOME_URL = '/api/home';
export const fetchHome = () => request<HomePayload>(HOME_URL);

export const catalogueUrl = (search: string) => `/api/catalogue${search}`;
export const fetchCatalogue = (search: string) => request<CatalogueListing>(catalogueUrl(search));

export const movieUrl = (parts: string[]) => `/api/movie/${parts.join('/')}`;
export const fetchMovie = (parts: string[]) => request<MovieDetailPayload>(movieUrl(parts));

export const actorUrl = (parts: string[]) => `/api/actor/${parts.join('/')}`;
export const fetchActor = (parts: string[]) => request<ActorDetailPayload>(actorUrl(parts));

export const SEARCH_INDEX_URL = '/api/search-index.json';
export const fetchSearchIndex = () => request<SearchIndexPayload>(SEARCH_INDEX_URL);

export const FEEDS_META_URL = '/api/feeds/meta';
export const fetchFeedsMeta = () => request<FeedsMetaPayload>(FEEDS_META_URL);

/** Search responses are query-specific; rely on the HTTP cache instead of RAM. */
export async function fetchSearchResults(query: string): Promise<SearchResultsPayload> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError(`Search failed with status ${response.status}`, response.status);
  return (await response.json()) as SearchResultsPayload;
}

export async function submitContact(values: Record<string, string>): Promise<void> {
  const response = await fetch(CONTACT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.');
}
