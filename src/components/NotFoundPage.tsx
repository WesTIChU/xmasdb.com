import React from 'react';

interface NotFoundPageProps {
  onNavigate: (path: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => (
  <section className="flex flex-col items-center py-10 text-center sm:py-14" aria-labelledby="not-found-heading">
    <h1 id="not-found-heading" className="font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">
      Well, this is awkward...
    </h1>
    <p className="mt-3 max-w-md font-body text-base leading-relaxed text-[#736B63] sm:text-lg">
      The Christmas movie you&apos;re looking for seems to have gone missing.
    </p>
    <a
      href="/"
      onClick={(event) => {
        event.preventDefault();
        onNavigate('/');
      }}
      className="mt-7 inline-flex items-center rounded-full bg-[#1A3D2F] px-5 py-2.5 font-sans-clean text-sm font-medium text-[#FAF7F2] transition-colors hover:bg-[#143626] focus:outline-none focus:ring-2 focus:ring-[#B8860B] focus:ring-offset-2 focus:ring-offset-[#FAF7F2]"
    >
      <span aria-hidden="true">🎄</span>
      <span className="ml-2">Back to XmasDB</span>
    </a>
  </section>
);
