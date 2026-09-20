import React from 'react';

export const AboutPage: React.FC = () => (
  <article className="mx-auto max-w-2xl py-10 sm:py-14" aria-labelledby="about-heading">
    <header className="border-b border-[#E7DFD5] pb-6 text-center">
      <h1 id="about-heading" className="font-heading text-3xl font-semibold text-[#1A3D2F] sm:text-4xl">Why XmasDB Exists</h1>
    </header>

    <div className="mt-8 space-y-5 font-body text-base leading-relaxed text-[#4A433B] sm:text-lg">
      <p>XmasDB started because I wanted a reliable way to feed Hallmark and Lifetime Christmas movies into Radarr.</p>
      <p>I was originally using Trakt lists for this, but changes to Trakt&apos;s website made the setup increasingly unreliable for my particular use and setup.</p>
      <p>So I built my own.</p>
      <p>XmasDB is mainly a project I made for myself: a curated Christmas movie database with reliable Radarr-compatible JSON feeds covering Hallmark, Lifetime and Great American Family.</p>
      <p>The site grew from there into something a bit bigger, with movie pages, actors, upcoming releases, archives and other ways to browse the collection.</p>
      <p>And yes, AI was used to help me build the site. I don&apos;t particularly care about hiding that. This isn&apos;t a company or some massive commercial project. It&apos;s something I wanted to exist and built for my own use.</p>
      <p>If other people find it useful, brilliant.</p>
      <p>If you like it, you like it. If you don&apos;t, you don&apos;t.</p>
      <p>That&apos;s pretty much it.</p>
    </div>

    <section className="mt-10 border-t border-[#E7DFD5] pt-6" aria-labelledby="about-purpose-heading">
      <h2 id="about-purpose-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">What it&apos;s for</h2>
      <p className="mt-3 font-body text-base leading-relaxed text-[#4A433B] sm:text-lg">
        A curated Christmas movie database for browsing Hallmark, Lifetime and Great American Family films, finding movies and actors, keeping up with upcoming Christmas releases, and using Radarr-compatible JSON feeds.
      </p>
    </section>
  </article>
);
