import React from 'react';
import { NavigationLink } from './NavigationLink';
import { buildCatalogueUrl } from '../utils/catalogue-pagination';

interface CataloguePaginationProps {
  pathname: string;
  search: string;
  page: number;
  totalPages: number;
  onNavigate: (path: string) => void;
}

function pageWindow(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const ordered = [...pages].filter((value) => value > 0 && value <= totalPages).sort((a, b) => a - b);
  const result: Array<number | 'ellipsis'> = [];
  ordered.forEach((value, index) => {
    if (index > 0 && value - ordered[index - 1] > 1) result.push('ellipsis');
    result.push(value);
  });
  return result;
}

export const CataloguePagination: React.FC<CataloguePaginationProps> = ({ pathname, search, page, totalPages, onNavigate }) => {
  if (totalPages <= 1) return null;
  const goTo = (target: number) => buildCatalogueUrl(pathname, search, { page: target }, false);
  return (
    <nav aria-label="Catalogue pagination" className="mt-8 flex items-center justify-center gap-3 text-sm font-sans-clean">
      {page > 1 && <NavigationLink href={goTo(page - 1)} onNavigate={onNavigate} className="shrink-0 text-[#1A3D2F] hover:text-[#143626]">← Previous</NavigationLink>}
      <div className="hidden sm:flex items-center gap-3">
        {pageWindow(page, totalPages).map((item, index) => item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="text-[#8C8379]">…</span>
        ) : (
          <NavigationLink
            key={item}
            href={goTo(item)}
            onNavigate={onNavigate}
            isActive={item === page}
            className={`min-w-5 text-center ${item === page ? 'font-semibold text-[#1A3D2F]' : 'text-[#59524A] hover:text-[#1A3D2F]'}`}
          >{item}</NavigationLink>
        ))}
      </div>
      <span className="sm:hidden text-[#59524A]">Page {page} of {totalPages}</span>
      {page < totalPages && <NavigationLink href={goTo(page + 1)} onNavigate={onNavigate} className="shrink-0 text-[#1A3D2F] hover:text-[#143626]">Next →</NavigationLink>}
    </nav>
  );
};
