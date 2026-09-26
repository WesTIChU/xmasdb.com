import { Movie } from '../types';
import { getMoviePremiereDateKey, isDateKeyInCalendarWeek, isMoviePremierePast } from './catalogue-lifecycle';

export const SUPPORTED_PER_PAGE = [24, 48, 96] as const;
export type CatalogueSort = 'catalogue' | 'newest' | 'oldest' | 'title' | 'title-desc';

export interface CatalogueQuery {
  page: number;
  perPage: number;
  sort: CatalogueSort;
  brand?: string;
  year?: number;
  status?: string;
  search?: string;
  releaseWeekStart?: string;
  releaseWeekEnd?: string;
}

export interface PaginatedMovies {
  movies: Movie[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
}

function getCatalogueSortDateKey(movie: Movie): string | null {
  const premiereDate = getMoviePremiereDateKey(movie);
  if (premiereDate) return premiereDate;
  return movie.releaseDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null;
}

export function parseCatalogueQuery(search: string): CatalogueQuery {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page'));
  const perPageValue = Number(params.get('perPage'));
  const yearValue = Number(params.get('year'));
  const sortValue = params.get('sort');
  const status = params.get('status')?.trim().toLowerCase() || undefined;
  const releaseWeekStartValue = params.get('releaseWeekStart')?.match(/^\d{2}-\d{2}$/)?.[0];
  const releaseWeekEndValue = params.get('releaseWeekEnd')?.match(/^\d{2}-\d{2}$/)?.[0];
  const sort: CatalogueSort = sortValue === 'newest' || sortValue === 'oldest' || sortValue === 'title' || sortValue === 'title-desc'
    ? sortValue
    : 'newest';

  return {
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    perPage: SUPPORTED_PER_PAGE.includes(perPageValue as typeof SUPPORTED_PER_PAGE[number]) ? perPageValue : 24,
    sort,
    brand: params.get('brand')?.trim().toLowerCase() || undefined,
    year: Number.isInteger(yearValue) && yearValue > 0 ? yearValue : undefined,
    status,
    search: params.get('search')?.trim().toLowerCase() || undefined,
    releaseWeekStart: releaseWeekStartValue,
    releaseWeekEnd: releaseWeekEndValue,
  };
}

export function getCataloguePage(movies: Movie[], query: CatalogueQuery, lockedBrand?: string, lockedYear?: number): PaginatedMovies {
  const sort = lockedYear === undefined && query.year === undefined && query.sort === 'catalogue'
    ? 'newest'
    : query.sort;
  let filtered = movies.filter((movie) => {
    const brand = lockedBrand || query.brand;
    const year = lockedYear || query.year;
    if (brand && movie.brandId.toLowerCase() !== brand.toLowerCase()) return false;
    if (year && movie.year !== year) return false;
    if (query.status && movie.status?.toLowerCase() !== query.status) return false;
    if (query.search && !(
      movie.title.toLowerCase().includes(query.search) ||
      movie.synopsis.toLowerCase().includes(query.search) ||
      movie.cast.some((cast) => cast.name.toLowerCase().includes(query.search!))
    )) return false;
    if (query.releaseWeekStart && query.releaseWeekEnd) {
      const dateKey = getMoviePremiereDateKey(movie);
      if (!dateKey || !isMoviePremierePast(movie) || !isDateKeyInCalendarWeek(dateKey, {
        startDateKey: `2000-${query.releaseWeekStart}`,
        endDateKey: `2000-${query.releaseWeekEnd}`,
      })) return false;
    }
    const status = movie.status?.toLowerCase();
    if (status !== 'collection' && status !== 'coming-soon') return false;
    return true;
  });

  if (sort === 'catalogue') {
    const comingSoon = filtered
      .filter((movie) => movie.status?.toLowerCase() === 'coming-soon')
      .sort((a, b) => {
        const aDate = getMoviePremiereDateKey(a);
        const bDate = getMoviePremiereDateKey(b);
        if (aDate === null && bDate === null) return 0;
        if (aDate === null) return 1;
        if (bDate === null) return -1;
        return aDate.localeCompare(bDate);
      });
    const collection = filtered.filter((movie) => movie.status?.toLowerCase() !== 'coming-soon');
    filtered = [...comingSoon, ...collection];
  } else if (sort === 'newest') {
    filtered = [...filtered].sort((a, b) => {
      const aDate = getCatalogueSortDateKey(a);
      const bDate = getCatalogueSortDateKey(b);
      if (aDate === null && bDate === null) return 0;
      if (aDate === null) return 1;
      if (bDate === null) return -1;
      return bDate.localeCompare(aDate);
    });
  } else if (sort === 'oldest') {
    filtered = [...filtered].sort((a, b) => {
      const aDate = getCatalogueSortDateKey(a);
      const bDate = getCatalogueSortDateKey(b);
      if (aDate === null && bDate === null) return 0;
      if (aDate === null) return 1;
      if (bDate === null) return -1;
      return aDate.localeCompare(bDate);
    });
  } else if (sort === 'title') {
    filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'title-desc') {
    filtered = [...filtered].sort((a, b) => b.title.localeCompare(a.title));
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.perPage));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.perPage;
  return { movies: filtered.slice(start, start + query.perPage), total, totalPages, page, perPage: query.perPage };
}

export function buildCatalogueUrl(pathname: string, search: string, changes: Record<string, string | number | undefined>, resetPage = true): string {
  const params = new URLSearchParams(search);
  Object.entries(changes).forEach(([key, value]) => {
    if (value === undefined || value === '') params.delete(key);
    else params.set(key, String(value));
  });
  if (resetPage && !Object.prototype.hasOwnProperty.call(changes, 'page')) params.set('page', '1');
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}
