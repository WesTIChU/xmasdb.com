import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { NavSquiggle } from './NavigationLink';

interface BackNavigationProps {
  href: string;
  label: string;
  id: string;
  title: string;
  onNavigate: (path: string) => void;
}

export const BackNavigation: React.FC<BackNavigationProps> = ({ href, label, id, title, onNavigate }) => (
  <a
    href={href}
    id={id}
    onClick={(event) => {
      event.preventDefault();
      onNavigate(href);
    }}
    className="group inline-flex items-center gap-2 text-xs sm:text-sm font-sans-clean font-medium text-[#1A3D2F] cursor-pointer transition-colors"
    title={title}
  >
    <ArrowLeft
      className="w-3.5 h-3.5 text-[#1A3D2F] shrink-0 transition-transform duration-200 ease-out group-hover:-translate-x-1 motion-reduce:transform-none"
      aria-hidden="true"
    />

    <span className="inline-flex items-center select-none shrink-0" aria-hidden="true">
      <svg
        className="w-4 h-4 transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon points="12,1.5 13.2,4.3 16.2,4.5 13.9,6.5 14.6,9.4 12,7.9 9.4,9.4 10.1,6.5 7.8,4.5 10.8,4.3" fill="#C59A3F" />
        <path d="M12 4.5 L15.8 8.8 L13.6 8.8 L17.2 13 L14.7 13 L18.8 18.2 L5.2 18.2 L9.3 13 L6.8 13 L10.4 8.8 L8.2 8.8 Z" fill="#1A3D2F" stroke="#143626" strokeWidth="0.5" strokeLinejoin="round" />
        <rect x="10.5" y="18.2" width="3" height="3.2" rx="0.5" fill="#6B4423" />
      </svg>
    </span>

    <span className="relative inline-block leading-normal">
      <span>{label}</span>
      <NavSquiggle />
    </span>

    <span className="inline-flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out select-none shrink-0" aria-hidden="true">
      <svg className="w-3 h-3 text-[#C59A3F] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 motion-reduce:transform-none" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
      </svg>
    </span>
  </a>
);
