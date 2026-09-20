import React from 'react';

interface NotFoundPageProps {
  onNavigate: (path: string) => void;
  onSearch: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate, onSearch }) => (
  <section className="flex flex-col items-center py-10 text-center sm:py-14" aria-labelledby="not-found-heading">
    <h1 id="not-found-heading" className="font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">
       WELL, THIS IS AWKWARD...
    </h1>
    <p className="mt-3 max-w-md font-body text-base leading-relaxed text-[#736B63] sm:text-lg">
      This movie isn&apos;t in the database.
    </p>
    <p className="mt-2 max-w-lg font-body text-sm leading-relaxed text-[#736B63]">
      Maybe Hallmark announced another one while Radarr was looking the other way.
    </p>
    <p className="mt-3 max-w-lg font-body text-xs leading-relaxed text-[#8A8178]">
      Lifetime says it wasn&apos;t them. Great American Family isn&apos;t answering. NZBGet knows nothing.
    </p>
    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={onSearch}
        className="inline-flex items-center rounded-full bg-[#1A3D2F] px-5 py-2.5 font-sans-clean text-sm font-medium text-[#FAF7F2] transition-colors hover:bg-[#143626] focus:outline-none focus:ring-2 focus:ring-[#B8860B] focus:ring-offset-2 focus:ring-offset-[#FAF7F2]"
      >
        SEARCH XMASDB
      </button>
      <a
        href="/movies/"
        onClick={(event) => {
          event.preventDefault();
          onNavigate('/movies/');
        }}
        className="inline-flex items-center rounded-full border border-[#1A3D2F] px-5 py-2.5 font-sans-clean text-sm font-medium text-[#1A3D2F] transition-colors hover:bg-[#EFE8DD] focus:outline-none focus:ring-2 focus:ring-[#B8860B] focus:ring-offset-2 focus:ring-offset-[#FAF7F2]"
      >
        BACK TO ALL MOVIES
      </a>
    </div>
    <p className="mt-7 font-sans-clean text-[11px] text-[#9A9187]">Error 404: Even Radarr couldn&apos;t find this one.</p>
  </section>
);
