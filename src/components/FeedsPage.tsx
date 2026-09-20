import React, { useState } from 'react';
import type { FeedsMetaPayload } from '../api/types';
import { SITE_ORIGIN } from '../utils/urls';
import { NavSquiggle } from './NavigationLink';

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
      <h3 className="font-heading text-lg font-semibold text-[#1A3D2F]">{title}</h3>
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
      <header className="mb-8 border-b border-[#E7DFD5] pb-7">
        <h1 className="font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">Christmas Movie Radarr &amp; JSON Feeds</h1>
        <p className="mt-2 max-w-xl font-body text-base leading-relaxed text-[#59524A]">
          Add XmasDB Christmas movie collections directly to Radarr. Choose a collection below and copy its feed URL.
        </p>
      </header>

      <section className="mb-9 border-b border-[#E7DFD5] pb-8" aria-labelledby="radarr-setup-heading">
        <h2 id="radarr-setup-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">HOW TO ADD TO RADARR</h2>
        <div className="mt-4 max-w-2xl space-y-2 font-body text-sm leading-relaxed text-[#59524A]">
          <p>In Radarr go to:</p>
          <p className="font-semibold text-[#1A3D2F]">Settings → Import Lists → + → Advanced List → StevenLu Custom</p>
          <p>Paste one of the XmasDB feed URLs below and save.</p>
        </div>
        <div className="mt-4 space-y-1 font-sans-clean text-xs text-[#6B6258]">
          <p>XmasDB automatically keeps these lists updated.</p>
          <p>Upcoming movies become eligible <span className="font-semibold">7 days</span> before their premiere.</p>
        </div>
      </section>

      <section className="mb-9 border-b border-[#E7DFD5] pb-8" aria-labelledby="collections-heading">
        <div className="mb-2">
          <h2 id="collections-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">CHOOSE A COLLECTION</h2>
        </div>
        <div className="grid gap-x-6 sm:grid-cols-2">
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

      <section className="mb-9 border-b border-[#E7DFD5] pb-8 pt-2" aria-labelledby="year-heading">
        <h2 id="year-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">BROWSE BY YEAR</h2>
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

      <section aria-labelledby="actor-feeds-heading">
        <h2 id="actor-feeds-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">ACTOR FEEDS</h2>
        <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-[#59524A]">
          Every actor in XmasDB has their own Radarr feed containing their eligible Christmas movies. Open an actor page and choose the JSON Feed link to copy their personal feed URL.
        </p>
        <code className="mt-3 block break-all font-mono text-xs leading-relaxed text-[#6B6258]">/json/actors/&#123;tmdbPersonId&#125;.json</code>
      </section>
    </div>
  );
};
