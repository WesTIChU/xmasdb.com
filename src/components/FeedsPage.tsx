import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FeedsMetaPayload, SearchIndexPayload, SearchPersonEntry } from '../api/types';
import { SEARCH_INDEX_URL, fetchSearchIndex, peekResolved } from '../api/client';
import { SITE_ORIGIN } from '../utils/urls';
import { NavSquiggle } from './NavigationLink';
import { HollyDivider } from './HollyDivider';
import { compareScoredResults, scoreActorSearchResult } from '../utils/search-relevance';

const feedGridColumns = 'md:grid-cols-[minmax(5rem,1.1fr)_minmax(7rem,1.2fr)_minmax(18rem,3fr)_minmax(4.5rem,0.7fr)_minmax(4rem,0.5fr)]';

function MajorSectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start">
      <h2 id={id} className="shrink-0 font-heading text-xl font-semibold tracking-[0.015em] text-[#1A3D2F] sm:text-2xl">{children}</h2>
      <span className="mt-1.5 h-px w-16 bg-[#DCCB9C]" aria-hidden="true" />
    </div>
  );
}

function CopyFeedAction({
  id,
  title,
  url,
  copiedId,
  onCopy,
  disabled = false,
}: {
  id: string;
  title: string;
  url: string;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
  disabled?: boolean;
}) {
  const isCopied = copiedId === id;
  return (
    <button
      type="button"
      onClick={() => onCopy(id, url)}
      disabled={disabled}
      className="xmas-nav-link inline-block cursor-pointer border-0 bg-transparent p-0 font-sans-clean text-xs font-medium text-[#1A3D2F] transition-colors hover:text-[#841818] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#841818] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-[#1A3D2F]"
      aria-label={isCopied ? `${title} feed URL copied` : `Copy ${title} feed URL`}
      aria-live="polite"
    >
      <span className="relative inline-block leading-normal">
        {isCopied ? 'Copied!' : 'Copy'}
        <NavSquiggle isActive={isCopied} />
      </span>
    </button>
  );
}

function FeedUrlLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block max-w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2.5 py-1.5 text-[#403A34] transition-colors hover:border-[#B8860B] hover:text-[#1A3D2F] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#841818]"
      aria-label={`Open JSON feed ${url} in a new tab`}
    >
      <code className="block break-all font-mono text-xs leading-relaxed md:whitespace-nowrap md:break-normal">{url}</code>
    </a>
  );
}

function FeedRow({
  id,
  title,
  endpoint,
  count,
  origin,
  copiedId,
  onCopy,
}: {
  id: string;
  title: string;
  endpoint: string;
  count: number;
  origin: string;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
}) {
  const url = `${origin}${endpoint}`;
  const countLabel = String(count);
  return (
    <article className={`grid gap-3 border-b border-[#E7DFD5] px-4 py-4 last:border-b-0 ${feedGridColumns} md:items-center md:gap-4 md:px-5`}>
      <div className="min-w-0">
        <h3 className="font-heading text-sm font-semibold text-[#1A3D2F] sm:text-base">{title}</h3>
        <p className="mt-1 font-sans-clean text-xs text-[#736B63] md:hidden">{countLabel}</p>
      </div>
      <div className="hidden min-w-0 md:block" aria-hidden="true" />
      <div className="min-w-0"><FeedUrlLink url={url} /></div>
      <p className="hidden min-w-0 justify-self-center whitespace-nowrap text-center font-sans-clean text-xs text-[#736B63] md:block">{countLabel}</p>
      <div className="min-w-0 justify-self-center text-center">
        <CopyFeedAction id={id} title={title} url={url} copiedId={copiedId} onCopy={onCopy} />
      </div>
    </article>
  );
}

function YearFeedRow({
  selectedYear,
  availableYears,
  yearCount,
  url,
  copiedId,
  onYearChange,
  onCopy,
}: {
  selectedYear: number;
  availableYears: number[];
  yearCount: number;
  url: string;
  copiedId: string | null;
  onYearChange: (year: number) => void;
  onCopy: (id: string, url: string) => void;
}) {
  const countLabel = String(yearCount);
  return (
    <article className={`grid gap-3 border-b border-[#E7DFD5] px-4 py-4 last:border-b-0 ${feedGridColumns} md:items-center md:gap-4 md:px-5`}>
      <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold text-[#1A3D2F] sm:text-base">BY YEAR</h3>
        <p className="mt-1 font-sans-clean text-xs text-[#736B63] md:hidden">{countLabel}</p>
      </div>
      <div className="min-w-0">
        <select
          value={selectedYear}
          onChange={(event) => onYearChange(Number(event.target.value))}
          className="w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1 font-sans-clean text-xs text-[#1A3D2F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#841818]"
          aria-label="Choose a year feed"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
      <div className="min-w-0"><FeedUrlLink url={url} /></div>
      <p className="hidden min-w-0 justify-self-center whitespace-nowrap text-center font-sans-clean text-xs text-[#736B63] md:block">{countLabel}</p>
      <div className="min-w-0 justify-self-center text-center">
        <CopyFeedAction id="radarr-year" title={`${selectedYear} year`} url={url} copiedId={copiedId} onCopy={onCopy} />
      </div>
    </article>
  );
}

function ActorFeedRow({
  actorCounts,
  origin,
  copiedId,
  onCopy,
}: {
  actorCounts: Record<string, number>;
  origin: string;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedActor, setSelectedActor] = useState<SearchPersonEntry | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexPayload | null>(
    () => peekResolved<SearchIndexPayload>(SEARCH_INDEX_URL) ?? null
  );
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldSearch = query.trim().length >= 2;

  useEffect(() => {
    if (!shouldSearch || searchIndex) return;
    let active = true;
    fetchSearchIndex()
      .then((index) => {
        if (active) setSearchIndex(index);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [shouldSearch, searchIndex]);

  const matchingActors = useMemo(() => {
    if (!shouldSearch || !searchIndex) return [];
    return searchIndex.people
      .map((actor) => ({ item: actor, score: scoreActorSearchResult(actor, query.trim().toLowerCase()) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => compareScoredResults(a, b) || b.item.movieCount - a.item.movieCount)
      .map(({ item }) => item)
      .slice(0, 5);
  }, [query, searchIndex, shouldSearch]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, shouldSearch]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const selectActor = (actor: SearchPersonEntry) => {
    setSelectedActor(actor);
    setQuery(actor.name);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || matchingActors.length === 0) {
      if (event.key === 'Escape') setIsOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((previous) => (previous < matchingActors.length - 1 ? previous + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((previous) => (previous > 0 ? previous - 1 : matchingActors.length - 1));
    } else if (event.key === 'Enter' && selectedIndex >= 0) {
      event.preventDefault();
      selectActor(matchingActors[selectedIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const actorUrl = selectedActor ? `${origin}/json/actors/${selectedActor.tmdbPersonId}.json` : null;
  const actorCount = selectedActor ? actorCounts[String(selectedActor.tmdbPersonId)] ?? 0 : null;
  const duplicateNames = new Set(
    matchingActors
      .filter((actor) => actor.name.toLowerCase() === query.trim().toLowerCase())
      .map((actor) => actor.name.toLowerCase())
  );

  return (
    <article className={`grid gap-3 border-b border-[#E7DFD5] px-4 py-4 last:border-b-0 ${feedGridColumns} md:items-center md:gap-4 md:px-5`}>
      <div className="min-w-0">
        <h3 className="font-heading text-sm font-semibold text-[#1A3D2F] sm:text-base">BY ACTOR</h3>
        <p className="mt-1 font-sans-clean text-xs text-[#736B63] md:hidden">{actorCount === null ? '—' : actorCount}</p>
      </div>
      <div ref={containerRef} className="relative min-w-0">
        <div className="relative min-w-0">
          <input
            type="search"
            value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedActor(null);
            setIsOpen(event.target.value.trim().length >= 2);
          }}
          onFocus={() => shouldSearch && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search actors..."
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="actor-feed-listbox"
            className="w-full min-w-0 rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1 font-sans-clean text-xs text-[#1A3D2F] placeholder-[#736B63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#841818]"
          />
          {isOpen && shouldSearch && (
            <div id="actor-feed-listbox" role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded border border-[#DCD3C7] bg-[#FFFDF9] shadow-lg">
              {matchingActors.length > 0 ? matchingActors.map((actor, index) => {
                const duplicate = duplicateNames.has(actor.name.toLowerCase());
                return (
                  <button
                    key={`${actor.slug}-${actor.tmdbPersonId}`}
                    type="button"
                    role="option"
                    aria-selected={selectedIndex === index}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => selectActor(actor)}
                    className={`block w-full px-2.5 py-1.5 text-left font-body text-xs text-[#1A3D2F] ${selectedIndex === index ? 'bg-[#F2ECE3]' : 'hover:bg-[#F8F4EE]'}`}
                  >
                    {actor.name}{duplicate && <span className="ml-1 text-[#736B63]">({actor.tmdbPersonId})</span>}
                  </button>
                );
              }) : <p className="px-2.5 py-2 font-body text-xs text-[#736B63]">No actors found.</p>}
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0">
        {actorUrl ? <FeedUrlLink url={actorUrl} /> : <span className="block w-full rounded border border-[#E7DFD5] bg-[#FAF7F2] px-2.5 py-1.5 font-mono text-xs leading-relaxed text-[#A29A91]">/json/actors/&#123;tmdbPersonId&#125;.json</span>}
      </div>
      <p className="hidden min-w-0 justify-self-center whitespace-nowrap text-center font-sans-clean text-xs text-[#736B63] md:block">{actorCount === null ? '—' : actorCount}</p>
      <div className="min-w-0 justify-self-center text-center">
        <CopyFeedAction id="radarr-actor" title={selectedActor ? `${selectedActor.name} actor` : 'actor'} url={actorUrl ?? ''} copiedId={copiedId} onCopy={onCopy} disabled={!selectedActor} />
      </div>
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
      title: brand.shortName,
      endpoint,
      count,
    };
  });

  const yearEndpoint = `/json/year/${selectedYear}.json`;
  const yearCount = meta.counts.years[String(selectedYear)] ?? 0;
  const yearUrl = `${origin}${yearEndpoint}`;

  return (
    <div id="feeds-page" className="mx-auto max-w-5xl px-0 py-6 text-left sm:py-8">
      <header className="pb-5 sm:pb-6">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-[0.015em] text-[#1A3D2F] sm:text-3xl">CHRISTMAS MOVIE FEEDS FOR RADARR</h1>
          <p className="mt-2 font-body text-base text-[#1A3D2F]">Direct JSON feeds for Radarr and other tools.</p>
          <p className="mx-auto mt-1 max-w-xl font-body text-sm leading-relaxed text-[#59524A]">
            Curated Christmas movie JSON feeds for Radarr, including Hallmark, Lifetime, Great American Family and UPtv. Choose a collection below and copy its feed URL.
          </p>
          <HollyDivider className="my-5 sm:my-6" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />
        </div>
      </header>

      <section id="feeds-setup" className="scroll-mt-6 pt-1 sm:scroll-mt-8" aria-labelledby="radarr-setup-heading">
        <MajorSectionHeading id="radarr-setup-heading">HOW TO ADD A FEED TO RADARR</MajorSectionHeading>
        <div className="mt-5 grid gap-5 sm:grid-cols-3 sm:gap-0">
          <div className="sm:border-r sm:border-[#E7DFD5] sm:pr-5">
            <div className="flex items-center gap-2">
              <span className="font-sans-clean text-sm font-semibold text-[#B8860B]">1</span>
              <h3 className="font-sans-clean text-xs font-semibold uppercase tracking-[0.12em] text-[#1A3D2F]">ADD AN IMPORT LIST</h3>
            </div>
            <p className="mt-2 font-body text-sm leading-relaxed text-[#59524A]">Settings → Import Lists → + → Advanced List → StevenLu Custom</p>
          </div>
          <div className="sm:border-r sm:border-[#E7DFD5] sm:px-5">
            <div className="flex items-center gap-2">
              <span className="font-sans-clean text-sm font-semibold text-[#B8860B]">2</span>
              <h3 className="font-sans-clean text-xs font-semibold uppercase tracking-[0.12em] text-[#1A3D2F]">PASTE THE FEED URL</h3>
            </div>
            <p className="mt-2 font-body text-sm leading-relaxed text-[#59524A]">Copy any XmasDB feed above and paste its URL into Radarr.</p>
          </div>
          <div className="sm:pl-5">
            <div className="flex items-center gap-2">
              <span className="font-sans-clean text-sm font-semibold text-[#B8860B]">3</span>
              <h3 className="font-sans-clean text-xs font-semibold uppercase tracking-[0.12em] text-[#1A3D2F]">SAVE</h3>
            </div>
            <p className="mt-2 font-body text-sm leading-relaxed text-[#59524A]">That&apos;s it — XmasDB keeps the list updated automatically.</p>
          </div>
        </div>
        <p className="mt-4 max-w-4xl font-sans-clean text-xs leading-relaxed text-[#736B63]"><span className="font-semibold text-[#1A3D2F]">Tip:</span> Give each XmasDB import list its own tag, such as <code className="rounded bg-[#F2E8CF] px-1 py-0.5 font-mono text-xs text-[#403A34]">xmasdb-hallmark</code>, to make imported movies easier to identify. Upcoming movies become feed-eligible <span className="font-semibold">7 days</span> before their premiere.</p>
      </section>

      <section id="feeds-collections" className="mt-10 scroll-mt-6 sm:mt-12 sm:scroll-mt-8" aria-labelledby="collections-heading">
        <MajorSectionHeading id="collections-heading">CHRISTMAS MOVIE JSON FEEDS</MajorSectionHeading>
        <div className="relative mt-5 rounded-md border border-[#DCD3C7] bg-[#FFFDF9] shadow-[0_8px_24px_rgba(26,61,47,0.04)]">
          <div className={`hidden gap-4 rounded-t-md bg-[#1A3D2F] px-5 py-3 text-center font-sans-clean text-[11px] font-semibold uppercase tracking-[0.12em] text-[#DCCB9C] ${feedGridColumns} md:grid`}>
            <span className="block min-w-0 w-full text-center">Collection</span>
            <span className="block min-w-0 w-full text-center">Filter</span>
            <span className="block min-w-0 w-full text-center">Feed URL</span>
            <span className="block min-w-0 w-full justify-self-center text-center">Movies</span>
            <span className="block min-w-0 w-full justify-self-center text-center">Action</span>
          </div>
          <FeedRow
            id="radarr-all"
            title="All Movies"
            endpoint="/json/all.json"
            count={meta.counts.all}
            origin={origin}
            copiedId={copiedId}
            onCopy={copyUrl}
          />
          {brandFeeds.map((feed) => (
            <FeedRow key={feed.id} {...feed} origin={origin} copiedId={copiedId} onCopy={copyUrl} />
          ))}
          <YearFeedRow
            selectedYear={selectedYear}
            availableYears={availableYears}
            yearCount={yearCount}
            url={yearUrl}
            copiedId={copiedId}
            onYearChange={setSelectedYear}
            onCopy={copyUrl}
          />
          <ActorFeedRow
            actorCounts={meta.counts.actors}
            origin={origin}
            copiedId={copiedId}
            onCopy={copyUrl}
          />
        </div>
      </section>

      <HollyDivider className="my-8 sm:my-10" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />

      <section id="feeds-faq" className="scroll-mt-6 sm:scroll-mt-8" aria-labelledby="feeds-faq-heading">
        <MajorSectionHeading id="feeds-faq-heading">FREQUENTLY ASKED QUESTIONS</MajorSectionHeading>
        <div className="mt-4 divide-y divide-[#E7DFD5] border-y border-[#E7DFD5]">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-sans-clean text-sm font-semibold text-[#1A3D2F] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] [&::-webkit-details-marker]:hidden">Why is the feed movie count lower than the XmasDB catalogue count?<span className="shrink-0 text-lg font-normal text-[#B8860B] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
            <p className="max-w-2xl pb-4 pr-8 font-body text-sm leading-relaxed text-[#736B63]">Upcoming movies can be added to the XmasDB catalogue as soon as they&apos;re discovered, but they don&apos;t become eligible for Radarr feeds until 7 days before their premiere. This gives metadata such as posters, cast and runtime time to populate.</p>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-sans-clean text-sm font-semibold text-[#1A3D2F] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] [&::-webkit-details-marker]:hidden">Do the XmasDB feeds update automatically?<span className="shrink-0 text-lg font-normal text-[#B8860B] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
            <p className="max-w-2xl pb-4 pr-8 font-body text-sm leading-relaxed text-[#736B63]">Yes. Once the feed URL is added to Radarr, the URL stays the same and XmasDB keeps the contents updated automatically.</p>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-sans-clean text-sm font-semibold text-[#1A3D2F] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] [&::-webkit-details-marker]:hidden">How often can Radarr check an XmasDB feed?<span className="shrink-0 text-lg font-normal text-[#B8860B] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
            <p className="max-w-2xl pb-4 pr-8 font-body text-sm leading-relaxed text-[#736B63]">Each individual feed allows up to 60 requests per hour per client. Normal Radarr polling is comfortably within this limit, so you should not need to change anything.</p>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-sans-clean text-sm font-semibold text-[#1A3D2F] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] [&::-webkit-details-marker]:hidden">Why am I getting HTTP 429 Too Many Requests?<span className="shrink-0 text-lg font-normal text-[#B8860B] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
            <p className="max-w-2xl pb-4 pr-8 font-body text-sm leading-relaxed text-[#736B63]">The same feed has been requested unusually frequently. XmasDB returns a Retry-After value telling the client when it can try again. Normal Radarr polling should not normally trigger this.</p>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-sans-clean text-sm font-semibold text-[#1A3D2F] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] [&::-webkit-details-marker]:hidden">Should I use Radarr tags with XmasDB feeds?<span className="shrink-0 text-lg font-normal text-[#B8860B] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
            <div className="max-w-2xl pb-4 pr-8 font-body text-sm leading-relaxed text-[#736B63]">
              <p>Yes. Separate tags make movies imported through XmasDB easier to identify and filter later.</p>
              <ul className="mt-2 space-y-1 pl-5 font-mono text-xs text-[#59524A]">
                <li><code>xmasdb-hallmark</code></li>
                <li><code>xmasdb-lifetime</code></li>
                <li><code>xmasdb-gaf</code></li>
                <li><code>xmasdb-uptv</code></li>
              </ul>
            </div>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-sans-clean text-sm font-semibold text-[#1A3D2F] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] [&::-webkit-details-marker]:hidden">Can I use more than one XmasDB feed?<span className="shrink-0 text-lg font-normal text-[#B8860B] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
            <p className="max-w-2xl pb-4 pr-8 font-body text-sm leading-relaxed text-[#736B63]">Yes. Hallmark, Lifetime, GAF, UPtv, year and other supported feeds can be added separately. Each feed has its own URL and its own rate-limit allowance.</p>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-sans-clean text-sm font-semibold text-[#1A3D2F] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] [&::-webkit-details-marker]:hidden">Does this work with NZBGet or SABnzbd?<span className="shrink-0 text-lg font-normal text-[#B8860B] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
            <p className="max-w-2xl pb-4 pr-8 font-body text-sm leading-relaxed text-[#736B63]">XmasDB feeds are added to Radarr. Radarr then uses the download client configured in your self-hosted media setup, such as NZBGet or SABnzbd. XmasDB does not communicate directly with either client; completed movies can then be organized in Plex or Jellyfin.</p>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-sans-clean text-sm font-semibold text-[#1A3D2F] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] [&::-webkit-details-marker]:hidden">What happens when a new Christmas movie is announced?<span className="shrink-0 text-lg font-normal text-[#B8860B] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
            <p className="max-w-2xl pb-4 pr-8 font-body text-sm leading-relaxed text-[#736B63]">XmasDB can add the movie to the catalogue when it&apos;s discovered. If its premiere is still in the future it follows the existing Coming Soon behaviour, and it becomes Radarr-feed eligible 7 days before its premiere.</p>
          </details>
        </div>
      </section>
    </div>
  );
};
