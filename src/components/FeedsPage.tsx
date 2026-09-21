import React, { useState } from 'react';
import type { FeedsMetaPayload } from '../api/types';
import { SITE_ORIGIN } from '../utils/urls';
import { NavigationLink, NavSquiggle } from './NavigationLink';
import { HollyDivider } from './HollyDivider';

interface FeedCardProps {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  count: number;
  origin: string;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
}

const feedDescriptions: Record<string, string> = {
  hallmark: 'Hallmark Christmas movies in XmasDB.',
  lifetime: 'Lifetime Christmas movies in XmasDB.',
  gaf: 'Great American Family Christmas movies in XmasDB.',
};

function CopyFeedAction({
  id,
  title,
  url,
  copiedId,
  onCopy,
}: {
  id: string;
  title: string;
  url: string;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
}) {
  const isCopied = copiedId === id;
  return (
    <div className="mt-2 block">
      <button
        type="button"
        onClick={() => onCopy(id, url)}
        className="xmas-nav-link cursor-pointer border-0 bg-transparent p-0 font-sans-clean text-xs font-medium text-[#1A3D2F] transition-colors hover:text-[#841818] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#841818]"
        aria-label={isCopied ? `${title} feed URL copied` : `Copy ${title} feed URL`}
        aria-live="polite"
      >
        <span className="relative inline-block leading-normal">
          {isCopied ? 'Copied!' : 'Copy feed URL'}
          <NavSquiggle isActive={isCopied} />
        </span>
      </button>
    </div>
  );
}

function FeedUrlLink({ url, className = 'mt-3' }: { url: string; className?: string }) {
  return (
    <div className={`block ${className}`}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="xmas-nav-link max-w-full text-[#403A34] transition-colors hover:text-[#1A3D2F] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#841818]"
        aria-label={`Open JSON feed ${url} in a new tab`}
      >
        <span className="relative inline-block max-w-full leading-relaxed">
          <code className="break-all font-mono text-xs">{url}</code>
          <NavSquiggle />
        </span>
      </a>
    </div>
  );
}

function MajorSectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start">
      <h2 id={id} className="shrink-0 font-heading text-xl font-semibold tracking-[0.015em] text-[#1A3D2F] sm:text-2xl">{children}</h2>
      <span className="mt-1.5 h-px w-16 bg-[#DCCB9C]" aria-hidden="true" />
    </div>
  );
}

function FeedCard({
  id,
  title,
  description,
  endpoint,
  count,
  origin,
  copiedId,
  onCopy,
}: FeedCardProps) {
  const url = `${origin}${endpoint}`;
  return (
      <article className="border-b border-[#E7DFD5] py-4 first:pt-0 sm:pr-5">
      <h3 className="font-heading text-base font-semibold text-[#1A3D2F] sm:text-lg">{title}</h3>
      <p className="mt-0.5 font-sans-clean text-xs text-[#736B63]"><span className="font-semibold">{count}</span> eligible Christmas {count === 1 ? 'movie' : 'movies'}</p>
      <p className="mt-1.5 font-body text-sm leading-relaxed text-[#6B6258]">{description}</p>
      <FeedUrlLink url={url} />
      <CopyFeedAction id={id} title={title} url={url} copiedId={copiedId} onCopy={onCopy} />
    </article>
  );
}

export const FeedsPage: React.FC<{ meta: FeedsMetaPayload }> = ({ meta }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    meta.years.includes(2025) ? 2025 : meta.years[0] ?? 2025
  );
  const origin = typeof window !== 'undefined' ? window.location.origin : SITE_ORIGIN;
  const availableYears = meta.years;

  const copyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2200);
    } catch {
      setCopiedId(null);
    }
  };

  const brandFeeds = meta.populatedBrands.map((brand) => {
    const endpoint = `/json/${brand.slug}.json`;
    const count = meta.counts.brands[brand.id] ?? 0;
    return {
      id: `radarr-${brand.id}`,
      title: brand.shortName.toUpperCase(),
      description: feedDescriptions[brand.id] ?? `${brand.name} Christmas movies in XmasDB.`,
      endpoint,
      count,
    };
  });

  const yearEndpoint = `/json/year/${selectedYear}.json`;
  const yearCount = meta.counts.years[String(selectedYear)] ?? 0;
  const yearUrl = `${origin}${yearEndpoint}`;

  return (
    <div id="feeds-page" className="mx-auto max-w-4xl px-0 py-7 text-left sm:py-10">
      <header className="mb-0 pb-5 sm:pb-6">
        <h1 className="font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">Radarr &amp; JSON Feeds</h1>
        <p className="mt-2 max-w-xl font-body text-base leading-relaxed text-[#59524A]">
          Add XmasDB Christmas movie collections directly to Radarr. Choose a collection below and copy its feed URL.
        </p>
        <nav className="quick-links-nav mt-5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 rounded-md bg-[#1A3D2F] px-3.5 py-2.5 font-sans-clean text-xs text-[#FAF7F2] sm:mt-6 sm:px-4 sm:py-3 sm:text-sm" aria-label="Quick links">
          <span className="font-semibold tracking-[0.16em]">QUICK LINKS</span>
          <span className="quick-links-sparkle text-[#DCCB9C]" aria-hidden="true">✦</span>
          <NavigationLink href="#feeds-setup" squiggleColor="#DCCB9C" className="text-[#FAF7F2] hover:text-[#DCCB9C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DCCB9C]">Setup</NavigationLink>
          <span className="text-[#B8860B]" aria-hidden="true">·</span>
          <NavigationLink href="#feeds-collections" squiggleColor="#DCCB9C" className="text-[#FAF7F2] hover:text-[#DCCB9C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DCCB9C]">Collections</NavigationLink>
          <span className="text-[#B8860B]" aria-hidden="true">·</span>
          <NavigationLink href="#feeds-years" squiggleColor="#DCCB9C" className="text-[#FAF7F2] hover:text-[#DCCB9C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DCCB9C]">Years</NavigationLink>
          <span className="text-[#B8860B]" aria-hidden="true">·</span>
          <NavigationLink href="#feeds-actors" squiggleColor="#DCCB9C" className="text-[#FAF7F2] hover:text-[#DCCB9C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DCCB9C]">Actor Feeds</NavigationLink>
        </nav>
      </header>

        <section id="feeds-setup" className="scroll-mt-6 pt-6 sm:scroll-mt-8 sm:pt-7" aria-labelledby="radarr-setup-heading">
        <MajorSectionHeading id="radarr-setup-heading">HOW TO ADD TO RADARR</MajorSectionHeading>
        <div className="mt-4 max-w-2xl space-y-2 font-body text-sm leading-relaxed text-[#59524A]">
          <p>In Radarr go to:</p>
          <p className="font-semibold text-[#1A3D2F]">Settings → Import Lists → + → Advanced List → StevenLu Custom</p>
          <p>Paste one of the XmasDB feed URLs below and save.</p>
        </div>
        <div className="mt-4 space-y-1 font-sans-clean text-xs text-[#6B6258]">
          <p>XmasDB automatically keeps these lists updated.</p>
           <p>Upcoming movies become eligible <span className="font-semibold">7 days</span> before their premiere. New releases often appear in XmasDB while their metadata is still incomplete, so this short delay gives details such as posters, cast, runtime and other movie information time to be updated before the movie is sent to Radarr.</p>
        </div>
      </section>

        <aside className="mt-8 rounded-md border border-[#DCCB9C] bg-[#FBF5E8] px-4 py-3.5 sm:px-5" aria-labelledby="radarr-tags-tip-heading">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h2 id="radarr-tags-tip-heading" className="font-sans-clean text-xs font-semibold uppercase tracking-[0.16em] text-[#1A3D2F]">RADARR TIP: USE TAGS</h2>
            <div className="mt-2 space-y-2 font-body text-sm leading-relaxed text-[#59524A]">
              <p>When adding an XmasDB import list to Radarr, give the list its own tag, for example <code className="rounded bg-[#F2E8CF] px-1 py-0.5 font-mono text-xs text-[#403A34]">xmasdb-hallmark</code>, <code className="rounded bg-[#F2E8CF] px-1 py-0.5 font-mono text-xs text-[#403A34]">xmasdb-lifetime</code>, or <code className="rounded bg-[#F2E8CF] px-1 py-0.5 font-mono text-xs text-[#403A34]">xmasdb-gaf</code>.</p>
              <p>Tags make it much easier to identify and filter movies added by XmasDB later, especially if your Radarr library also contains regular movies.</p>
              <p>Example: Hallmark feed → <code className="rounded bg-[#F2E8CF] px-1 py-0.5 font-mono text-xs text-[#403A34]">xmasdb-hallmark</code></p>
              <p>Setting this up from the start makes managing a large Christmas collection much easier.</p>
            </div>
          </div>
        </div>
       </aside>

       <HollyDivider className="my-8 sm:my-10" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />

       <section id="feeds-collections" className="scroll-mt-6 sm:scroll-mt-8" aria-labelledby="collections-heading">
         <div className="mb-2">
           <MajorSectionHeading id="collections-heading">CHOOSE A COLLECTION</MajorSectionHeading>
         </div>
         <p className="mb-5 mt-3 max-w-2xl font-sans-clean text-xs leading-relaxed text-[#736B63] sm:text-sm">
           <span className="font-semibold text-[#59524A]">Why are these numbers different?</span> Feed counts may be lower than the main XmasDB catalogue totals. Upcoming movies are added to XmasDB as soon as we discover them, but they do not become eligible for Radarr feeds until 7 days before their premiere. This gives their metadata time to fill out before they are sent to Radarr.
         </p>
         <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 sm:[&>article:nth-last-child(-n+2)]:border-b-0">
          <FeedCard
            id="radarr-all"
            title="ALL MOVIES"
            description="Every eligible Christmas movie in XmasDB."
            endpoint="/json/all.json"
            count={meta.counts.all}
            origin={origin}
            copiedId={copiedId}
            onCopy={copyUrl}
          />
          {brandFeeds.map((feed) => (
            <FeedCard key={feed.id} {...feed} origin={origin} copiedId={copiedId} onCopy={copyUrl} />
          ))}
        </div>
      </section>

       <HollyDivider className="my-8 sm:my-10" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />

       <section id="feeds-years" className="scroll-mt-6 sm:scroll-mt-8" aria-labelledby="year-heading">
        <MajorSectionHeading id="year-heading">BROWSE BY YEAR</MajorSectionHeading>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-sm sm:text-base" aria-label="Choose a year feed">
          {availableYears.map((year, index) => (
            <React.Fragment key={year}>
              {index > 0 && <span className="text-[#C8BFB3]" aria-hidden="true">·</span>}
              <button
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`xmas-nav-link cursor-pointer border-0 bg-transparent px-1 py-0.5 text-[#59524A] transition-colors hover:text-[#1A3D2F] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#841818] ${selectedYear === year ? 'is-active font-bold text-[#1A3D2F]' : ''}`}
                aria-pressed={selectedYear === year}
              >
                <span className="relative inline-block leading-normal">
                  {year}
                  <NavSquiggle isActive={selectedYear === year} />
                </span>
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="mt-5 max-w-xl">
          <p className="font-sans-clean text-xs text-[#736B63]">{yearCount} eligible Christmas {yearCount === 1 ? 'movie' : 'movies'} from {selectedYear}</p>
          <FeedUrlLink url={yearUrl} className="mt-2" />
          <CopyFeedAction id="radarr-year" title={`${selectedYear} year`} url={yearUrl} copiedId={copiedId} onCopy={copyUrl} />
        </div>
      </section>

       <HollyDivider className="my-8 sm:my-10" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />

       <section id="feeds-actors" className="scroll-mt-6 sm:scroll-mt-8" aria-labelledby="actor-feeds-heading">
         <MajorSectionHeading id="actor-feeds-heading">ACTOR FEEDS</MajorSectionHeading>
        <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-[#59524A]">
          Every actor in XmasDB has their own Radarr feed containing their eligible Christmas movies. Open an actor page and choose the JSON Feed link to copy their personal feed URL.
        </p>
        <code className="mt-3 block break-all font-mono text-xs leading-relaxed text-[#6B6258]">/json/actors/&#123;tmdbPersonId&#125;.json</code>
      </section>
    </div>
  );
};
