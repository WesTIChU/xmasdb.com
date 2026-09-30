import React from 'react';

export const PrivacyPage: React.FC = () => (
  <article className="page-container--standard mx-auto py-10 sm:py-14" aria-labelledby="privacy-heading">
    <div className="relative rounded border border-[#D8C8A4] bg-[#F4F0E8] px-4 py-4 sm:px-5 sm:py-5">
      <svg className="pointer-events-none absolute -top-2 left-3 h-5 w-14 bg-[#F4F0E8] px-1" viewBox="0 0 56 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M2 14C10 12 13 7 19 5M54 14C46 12 43 7 37 5" stroke="#1A3D2F" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M11 11C14 9 17 9 20 10M45 11C42 9 39 9 36 10M15 8C17 6 19 5 22 5M41 8C39 6 37 5 34 5" stroke="#1A3D2F" strokeWidth="1" strokeLinecap="round" />
        <circle cx="25" cy="10" r="2" fill="#841818" />
        <circle cx="31" cy="10" r="2" fill="#841818" />
        <path d="M27.8 3L28.5 5.1L30.7 5.1L28.9 6.4L29.6 8.5L27.8 7.2L26 8.5L26.7 6.4L24.9 5.1L27.1 5.1L27.8 3Z" fill="#B8860B" />
      </svg>
      <header className="border-b border-[#E7DFD5] pb-6 text-center">
        <h1 id="privacy-heading" className="font-heading text-3xl font-semibold text-[#1A3D2F] sm:text-4xl">PRIVACY &amp; AI</h1>
      </header>

      <div className="mt-8 space-y-5 font-body text-base leading-relaxed text-[#4A433B] sm:text-lg">
        <section>
          <h2 className="font-heading text-xl font-semibold text-[#1A3D2F]">Your privacy</h2>
          <p className="mt-2">XmasDB is a small personal Christmas movie database, not a commercial tracking platform. The site does not require user accounts, collect personal information through forms, sell personal data, use advertising trackers or build advertising profiles.</p>
          <p className="mt-3">That does not mean no technical information exists anywhere in the delivery of the site. Hosting, CDN or other infrastructure may process normal request information such as IP addresses, browser details and server logs to deliver, secure and keep the site running. Public feed IP addresses may also be used temporarily to enforce feed rate limits; raw IP addresses are not written to XmasDB feed statistics. That is different from XmasDB deliberately collecting personal information for its own database or advertising.</p>
          <p className="mt-3">XmasDB uses a self-hosted GoatCounter instance for privacy-friendly aggregate visitor statistics. It does not use analytics cookies or track visitors across websites.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold text-[#1A3D2F]">The catalogue is curated</h2>
          <p className="mt-2">Movie information, artwork and identifiers may come from third-party sources such as TMDB. XmasDB&apos;s selection, organisation and brand classification are maintained for the purpose of this site, and the movie catalogue is curated and reviewed rather than presented as a set of AI-generated guesses.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold text-[#1A3D2F]">AI assistance</h2>
          <p className="mt-2">Yes, AI tools have helped me build parts of XmasDB, including coding, design ideas and development work. I am not trying to hide that. This is still my personal project, and I decide what goes into the catalogue and how the site works.</p>
        </section>
      </div>
    </div>
  </article>
);
