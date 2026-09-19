import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Film } from 'lucide-react';
import type { FeedsMetaPayload } from '../api/types';
import { SITE_ORIGIN } from '../utils/urls';

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
  const isCopied = copiedId === id;

  return (
    <article className="rounded-lg border border-[#E7DFD5] bg-[#FFFDF9] p-4 sm:p-5 transition-colors hover:border-[#D6CCC0]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold text-[#1A3D2F]">{title}</h3>
          <p className="mt-1 font-body text-sm leading-relaxed text-[#6B6258]">{description}</p>
        </div>
        <span className="shrink-0 pt-1 font-sans-clean text-xs text-[#736B63]" aria-label={`${count} movies`}>
          {count} {count === 1 ? 'movie' : 'movies'}
        </span>
      </div>

      <div className="mb-3 flex min-w-0 items-center gap-2 rounded border border-[#E7DFD5] bg-[#FAF7F2] px-2.5 py-2">
        <code className="min-w-0 flex-1 truncate text-xs text-[#4A433B]">{url}</code>
        <button
          type="button"
          onClick={() => onCopy(id, url)}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-1 font-sans-clean text-xs text-[#59524A] transition-colors hover:bg-[#EFE8DD] hover:text-[#1A3D2F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#841818]"
          aria-label={isCopied ? 'Feed URL copied' : `Copy ${title} feed URL`}
          aria-live="polite"
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-[#1A4D33]" /> : <Copy className="h-3.5 w-3.5" />}
          <span className={isCopied ? 'text-[#1A4D33]' : undefined}>{isCopied ? 'Copied ✓' : 'Copy URL'}</span>
        </button>
      </div>

      <a
        href={endpoint}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#DCD3C7] bg-[#FAF7F2] px-3 py-1.5 font-sans-clean text-xs text-[#1A3D2F] transition-colors hover:bg-[#EFE8DD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#841818]"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open Feed
      </a>
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

  return (
    <div id="feeds-page" className="mx-auto max-w-4xl px-0 py-7 text-left sm:py-10">
      <header className="mb-7 border-b border-[#E7DFD5] pb-6">
        <h1 className="font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">RADARR FEEDS</h1>
        <p className="mt-2 max-w-xl font-body text-base leading-relaxed text-[#59524A]">
          Add XmasDB Christmas movie collections directly to Radarr. Choose a collection below and copy its feed URL.
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-[#DDD4C6] bg-[#F5EFE6] p-4 sm:p-5" aria-labelledby="radarr-setup-heading">
        <div className="flex items-start gap-3">
          <Film className="mt-0.5 h-5 w-5 shrink-0 text-[#841818]" />
          <div>
            <h2 id="radarr-setup-heading" className="font-heading text-lg font-semibold text-[#1A3D2F]">HOW TO ADD TO RADARR</h2>
            <p className="mt-2 font-body text-sm leading-relaxed text-[#59524A]">
              In Radarr go to: <strong>Settings → Import Lists → + → Advanced List → StevenLu Custom</strong>
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed text-[#59524A]">Paste one of the XmasDB feed URLs below and save.</p>
            <p className="mt-2 font-sans-clean text-xs text-[#6B6258]">XmasDB automatically keeps these lists updated.</p>
            <p className="mt-1 font-sans-clean text-xs text-[#6B6258]">Upcoming movies become eligible 7 days before their premiere.</p>
          </div>
        </div>
      </section>

      <section className="mb-8" aria-labelledby="collections-heading">
        <div className="mb-3 flex items-center justify-between border-b border-[#E7DFD5] pb-2">
          <h2 id="collections-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">CHOOSE A COLLECTION</h2>
          <span className="font-sans-clean text-xs text-[#736B63]">{meta.counts.all} total movies</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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

      <section className="mb-8 rounded-lg border border-[#E7DFD5] bg-[#FFFDF9] p-4 sm:p-5" aria-labelledby="year-heading">
        <h2 id="year-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">BROWSE BY YEAR</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="feed-year-select" className="font-sans-clean text-sm text-[#59524A]">Year:</label>
          <select
            id="feed-year-select"
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="w-full cursor-pointer rounded border border-[#DCD3C7] bg-[#FAF7F2] px-2.5 py-2 font-sans-clean text-sm text-[#23211E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#841818] sm:w-auto"
          >
            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <code className="min-w-0 flex-1 truncate text-xs text-[#4A433B]">{origin}{yearEndpoint}</code>
          <span className="font-sans-clean text-xs text-[#736B63]">{yearCount} movies</span>
          <button type="button" onClick={() => copyUrl('radarr-year', `${origin}${yearEndpoint}`)} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border border-[#DCD3C7] bg-[#FAF7F2] px-3 py-2 font-sans-clean text-xs text-[#1A3D2F] hover:bg-[#EFE8DD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#841818]" aria-label="Copy selected year feed URL">
            {copiedId === 'radarr-year' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedId === 'radarr-year' ? 'Copied ✓' : 'Copy URL'}
          </button>
          <a href={yearEndpoint} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border border-[#DCD3C7] bg-[#FAF7F2] px-3 py-2 font-sans-clean text-xs text-[#1A3D2F] hover:bg-[#EFE8DD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#841818]">
            <ExternalLink className="h-3.5 w-3.5" />
            Open Feed
          </a>
        </div>
      </section>

      <aside className="rounded-lg border border-[#DDD4C6] bg-[#F5EFE6] p-4 sm:p-5" aria-labelledby="actor-feeds-heading">
        <h2 id="actor-feeds-heading" className="font-heading text-lg font-semibold text-[#1A3D2F]">ACTOR FEEDS</h2>
        <p className="mt-2 font-body text-sm leading-relaxed text-[#59524A]">
          Every actor in XmasDB has their own Radarr feed containing their eligible Christmas movies. Open any actor page and choose <strong>JSON Feed</strong> to get their personal feed.
        </p>
        <code className="mt-2 block font-mono text-xs text-[#6B6258]">/json/actors/&#123;tmdbPersonId&#125;.json</code>
      </aside>
    </div>
  );
};
