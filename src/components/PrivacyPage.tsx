import React from 'react';

export const PrivacyPage: React.FC = () => (
  <article className="mx-auto max-w-2xl py-10 sm:py-14" aria-labelledby="privacy-heading">
    <header className="border-b border-[#E7DFD5] pb-6 text-center">
      <h1 id="privacy-heading" className="font-heading text-3xl font-semibold text-[#1A3D2F] sm:text-4xl">PRIVACY &amp; AI</h1>
    </header>

    <div className="mt-8 space-y-5 font-body text-base leading-relaxed text-[#4A433B] sm:text-lg">
      <section>
        <h2 className="font-heading text-xl font-semibold text-[#1A3D2F]">Your privacy</h2>
        <p className="mt-2">XmasDB is a small personal Christmas movie database, not a commercial tracking platform. The site does not require user accounts, collect personal information through forms, sell personal data, use advertising trackers or build advertising profiles.</p>
        <p className="mt-3">That does not mean no technical information exists anywhere in the delivery of the site. Hosting, CDN or other infrastructure may process normal request information such as IP addresses, browser details and server logs to deliver, secure and keep the site running. That is different from XmasDB deliberately collecting personal information for its own database or advertising.</p>
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
  </article>
);
