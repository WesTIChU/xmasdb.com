import React from 'react';
import { CatalogueQuery, SUPPORTED_PER_PAGE, buildCatalogueUrl } from '../utils/catalogue-pagination';

interface CatalogueControlsProps {
  pathname: string;
  search: string;
  query: CatalogueQuery;
  total: number;
  page: number;
  onNavigate: (path: string) => void;
}

export const CatalogueControls: React.FC<CatalogueControlsProps> = ({ pathname, search, query, total, page, onNavigate }) => {
  const update = (changes: Record<string, string | number | undefined>) => onNavigate(buildCatalogueUrl(pathname, search, changes));
  const start = total === 0 ? 0 : (page - 1) * query.perPage + 1;
  const end = Math.min(page * query.perPage, total);
  return (
    <div className="mt-4 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm font-sans-clean">
      <p className="text-[#736B63]">{total === 0 ? 'No movies found' : `Showing ${start}–${end} of ${total} ${total === 1 ? 'movie' : 'movies'}`}</p>
      <div className="flex flex-wrap items-center gap-3 text-[#1A3D2F]">
        <label className="inline-flex items-center gap-2">
          <span>Show</span>
          <select
            value={query.perPage}
            onChange={(event) => update({ perPage: Number(event.target.value) })}
            className="rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1 text-[#1A3D2F] shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#1A3D2F]"
            aria-label="Results per page"
          >
            {SUPPORTED_PER_PAGE.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <span>per page</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <span>Sort</span>
          <select
            value={query.sort}
            onChange={(event) => update({ sort: event.target.value === 'catalogue' ? undefined : event.target.value })}
            className="rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1 text-[#1A3D2F] shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#1A3D2F]"
            aria-label="Sort movies"
          >
            <option value="catalogue">Catalogue order</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>
    </div>
  );
};
