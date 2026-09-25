import React, { useEffect, useState } from 'react';
import type { TmdbRefreshFailure, TmdbRefreshHealthPayload, TmdbRefreshRun } from '../api/types';

interface Props { onNavigate: (path: string) => void; }

function dateTime(value?: string): string {
  if (!value) return 'Never';
  return `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC`;
}

function duration(milliseconds?: number): string {
  if (milliseconds === undefined) return '—';
  const seconds = Math.round(milliseconds / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function statusClass(status?: string): string {
  if (status === 'SUCCESS') return 'text-[#1A3D2F]';
  if (status === 'PARTIAL' || status === 'RUNNING') return 'text-[#B8860B]';
  return 'text-[#841818]';
}

function statusLabel(status?: string): string { return status || 'UNKNOWN'; }

type CardDecoration = 'holly' | 'star' | 'snow';

function CardDetail({ variant }: { variant: CardDecoration }) {
  if (variant === 'holly') return <span aria-hidden="true" className="pointer-events-none absolute right-3 top-3 opacity-35"><span className="absolute -left-1 top-0 h-1.5 w-2.5 -rotate-[25deg] rounded-full bg-[#1A3D2F]" /><span className="absolute left-1 top-1 h-1.5 w-2.5 rotate-[25deg] rounded-full bg-[#1A3D2F]" /><span className="absolute left-3 top-0 h-1.5 w-1.5 rounded-full bg-[#841818]" /><span className="absolute left-4 top-2 h-1.5 w-1.5 rounded-full bg-[#841818]" /></span>;
  if (variant === 'star') return <span aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-2 w-2 rotate-45 border border-[#B8860B] opacity-45" />;
  return <span aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-1 w-1 rounded-full bg-[#C8BFB3] opacity-70 shadow-[5px_3px_0_#DCD3C7,1px_7px_0_#DCD3C7]" />;
}

function StatCard({ label, value, variant = 'snow' }: { label: string; value: string | number; variant?: CardDecoration }) {
  return <div className="relative overflow-hidden rounded-md border border-[#DCD3C7] bg-[#FFFDF9] px-4 py-4">
    <CardDetail variant={variant} />
    <p className="font-sans-clean text-[10px] font-semibold tracking-[0.14em] text-[#736B63]">{label}</p>
    <p className="mt-2 font-heading text-2xl font-semibold text-[#1A3D2F]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
  </div>;
}

function RefreshSummary({ label, run, date, variant = 'snow' }: { label: string; run?: TmdbRefreshRun; date?: string; variant?: CardDecoration }) {
  return <div className="relative overflow-hidden rounded-md border border-[#DCD3C7] bg-[#FFFDF9] px-4 py-4">
    <CardDetail variant={variant} />
    <p className="font-sans-clean text-[10px] font-semibold tracking-[0.14em] text-[#736B63]">{label}</p>
    {run ? <><p className={`mt-2 text-sm font-semibold ${statusClass(run.status)}`}>{statusLabel(run.status)}</p><p className="mt-1 text-xs text-[#736B63]">{dateTime(run.finishedAt || run.startedAt)}</p></> : <p className="mt-2 text-xs text-[#736B63]">{dateTime(date)}</p>}
  </div>;
}

function SecondaryLine({ items }: { items: Array<[string, string | number]> }) {
  return <p className="mt-3 font-sans-clean text-xs text-[#736B63]">{items.map(([label, value], index) => <React.Fragment key={label}><span>{label}: <strong className="text-[#403A34]">{typeof value === 'number' ? value.toLocaleString() : value}</strong></span>{index < items.length - 1 && <span className="mx-2 text-[#C8BFB3]">·</span>}</React.Fragment>)}</p>;
}

function FailureDetails({ failures }: { failures: TmdbRefreshFailure[] }) {
  if (!failures.length) return null;
  return <details className="text-xs">
    <summary className="cursor-pointer font-semibold text-[#841818]">{failures.length} failure{failures.length === 1 ? '' : 's'}</summary>
    <div className="mt-2 space-y-2 border-l-2 border-[#D8B7AE] pl-3">{failures.map((failure) => <div key={`${failure.key}-${failure.timestamp}`}>
      <p className="font-semibold text-[#403A34]">{failure.kind} {failure.tmdbId ? `#${failure.tmdbId}` : ''} · {failure.operation}</p>
      <p className="text-[#736B63]">{failure.message} · {dateTime(failure.timestamp)}{failure.httpStatus ? ` · HTTP ${failure.httpStatus}` : ''}</p>
      {failure.recoveredAt && <p className="text-[#1A3D2F]">Recovered {dateTime(failure.recoveredAt)}</p>}
    </div>)}</div>
  </details>;
}

export const AdminTmdbRefreshHealth: React.FC<Props> = ({ onNavigate }) => {
  const [payload, setPayload] = useState<TmdbRefreshHealthPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/tmdb-refresh-health', { credentials: 'same-origin' })
      .then(async (response) => {
        const next = await response.json().catch(() => null) as TmdbRefreshHealthPayload | { error?: string } | null;
        if (response.status === 401) { onNavigate('/admin/login/'); return; }
        if (!response.ok || !next || !('current' in next)) throw new Error((next as { error?: string } | null)?.error || 'TMDB refresh health could not be loaded.');
        setPayload(next);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'TMDB refresh health could not be loaded.'));
  }, [onNavigate]);

  if (!payload) return <section className="mb-10 border-b border-[#E7DFD5] pb-8 text-sm text-[#736B63]" aria-labelledby="tmdb-health-heading"><h2 id="tmdb-health-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">TMDB REFRESH HEALTH</h2><p className="mt-3">{error || 'Loading refresh health...'}</p></section>;

  const latest = payload.latestRun;
  const latestCounters = latest?.counters || {};
  const actorMigration = payload.actors.legacyInitially === undefined ? `${payload.actors.remaining.toLocaleString()} remaining` : `${payload.actors.legacyInitially.toLocaleString()} initially · ${payload.actors.processedThisRun || 0} processed this run · ${payload.actors.remaining.toLocaleString()} remaining`;
  const imageMigration = latest?.legacyImagesBefore === undefined ? `${payload.images.posters.legacy + payload.images.backdrops.legacy + payload.images.people.legacy} remaining` : `${latest.legacyImagesBefore.toLocaleString()} initially · ${(latest.legacyImagesProcessed || 0).toLocaleString()} processed this run · ${(payload.images.posters.legacy + payload.images.backdrops.legacy + payload.images.people.legacy).toLocaleString()} remaining`;

  return <section className="mb-10 border-b border-[#E7DFD5] pb-8" aria-labelledby="tmdb-health-heading">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 id="tmdb-health-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">TMDB REFRESH HEALTH</h2><p className={`mt-1 text-sm font-semibold ${payload.current.status === 'HEALTHY' ? 'text-[#1A3D2F]' : 'text-[#B8860B]'}`}>{payload.current.status}</p></div>
      <p className="font-sans-clean text-xs text-[#736B63]">5-month freshness threshold</p>
    </div>
    {payload.current.reasons.length > 0 && <p className="mt-4 border-l-2 border-[#B8860B] bg-[#F7F2EB] px-4 py-3 text-xs text-[#736B63]">{payload.current.reasons.join(' · ')}</p>}

    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <RefreshSummary label="LAST FULL REFRESH" run={payload.lastFull} variant="holly" />
      <RefreshSummary label="LAST COMING SOON REFRESH" run={payload.lastComingSoon} variant="star" />
      <RefreshSummary label="NEXT FULL REFRESH" date={payload.schedule.nextFull} variant="snow" />
      <RefreshSummary label="NEXT COMING SOON" date={payload.schedule.nextComingSoon} variant="holly" />
    </div>

    <section className="mt-7" aria-labelledby="tmdb-movies-health-heading">
      <h3 id="tmdb-movies-health-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">MOVIES</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"><StatCard label="TOTAL" value={payload.movies.total} variant="holly" /><StatCard label="FRESH" value={payload.movies.fresh} variant="star" /><StatCard label="STALE" value={payload.movies.stale} variant="snow" /><StatCard label="FAILED" value={payload.movies.failed} variant="holly" /></div>
      <SecondaryLine items={[[ 'Checked', payload.movies.checked ], [ 'Changed', payload.movies.changed ], [ 'Unchanged', payload.movies.unchanged ], [ 'Oldest successful fetch', dateTime(payload.movies.oldestSuccessfulFetch) ], [ 'Never fetched', payload.movies.neverFetched ]]}/>
    </section>

    <section className="mt-7" aria-labelledby="tmdb-actors-health-heading">
      <h3 id="tmdb-actors-health-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">ACTORS / PEOPLE</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"><StatCard label="TOTAL" value={payload.actors.total} variant="snow" /><StatCard label="FRESH" value={payload.actors.fresh} variant="star" /><StatCard label="STALE" value={payload.actors.stale} variant="snow" /><StatCard label="LEGACY" value={payload.actors.legacy} variant="holly" /></div>
      <SecondaryLine items={[[ 'Attempted', payload.actors.attempted ], [ 'Refreshed', payload.actors.successful ], [ 'Failed', payload.actors.failed ], [ 'Skipped fresh', payload.actors.skippedFresh ], [ 'Oldest successful fetch', dateTime(payload.actors.oldestSuccessfulFetch) ]]}/>
      <p className="mt-3 font-sans-clean text-xs text-[#736B63]">Actor migration: <strong className="text-[#403A34]">{actorMigration}</strong></p>
    </section>

    <section className="mt-7" aria-labelledby="tmdb-images-health-heading">
      <h3 id="tmdb-images-health-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">IMAGES</h3>
      <div className="mt-4 overflow-x-auto rounded-md border border-[#E7DFD5] bg-[#FFFDF9]"><table className="w-full min-w-[620px] border-collapse text-left font-sans-clean text-sm"><thead><tr className="border-b border-[#DCD3C7] text-xs uppercase tracking-[0.12em] text-[#736B63]"><th className="px-3 py-3 font-semibold">Kind</th><th className="px-3 py-3 text-right font-semibold">Total</th><th className="px-3 py-3 text-right font-semibold">Fresh</th><th className="px-3 py-3 text-right font-semibold">Stale</th><th className="px-3 py-3 text-right font-semibold">Legacy</th><th className="px-3 py-3 text-right font-semibold">Refreshed</th><th className="px-3 py-3 text-right font-semibold">Failed</th></tr></thead><tbody className="divide-y divide-[#EEE7DE]">{(['posters', 'backdrops', 'people'] as const).map((kind) => { const image = payload.images[kind]; return <tr key={kind}><th scope="row" className="px-3 py-3 font-medium capitalize text-[#1A3D2F]">{kind}</th><td className="px-3 py-3 text-right text-[#403A34]">{image.total.toLocaleString()}</td><td className="px-3 py-3 text-right text-[#403A34]">{image.fresh.toLocaleString()}</td><td className="px-3 py-3 text-right text-[#403A34]">{image.stale.toLocaleString()}</td><td className="px-3 py-3 text-right text-[#403A34]">{image.legacy.toLocaleString()}</td><td className="px-3 py-3 text-right text-[#403A34]">{image.refreshedThisRun.toLocaleString()}</td><td className="px-3 py-3 text-right text-[#403A34]">{image.failedThisRun.toLocaleString()}</td></tr>; })}</tbody></table></div>
      <p className="mt-3 font-sans-clean text-xs text-[#736B63]">Image migration: <strong className="text-[#403A34]">{imageMigration}</strong></p>
    </section>

    {latest && <section className="mt-7" aria-labelledby="tmdb-latest-run-heading"><h3 id="tmdb-latest-run-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">LATEST REFRESH RUN</h3><div className="mt-4 rounded-md border border-[#E7DFD5] bg-[#FFFDF9] px-4 py-4"><SecondaryLine items={[[ 'Started', dateTime(latest.startedAt) ], [ 'Finished', dateTime(latest.finishedAt) ], [ 'Duration', duration(latest.durationMs) ], [ 'Movies', `${latestCounters.moviesSuccessful || 0}/${latestCounters.moviesAttempted || 0}` ], [ 'Actors', `${latestCounters.actorsSuccessful || 0}/${latestCounters.actorsAttempted || 0}` ], [ 'Images', `${latestCounters.imagesSuccessful || 0}/${latestCounters.imagesAttempted || 0}` ], [ 'Failures', latest.failures.length ], [ 'Status', latest.status ]]}/><FailureDetails failures={latest.failures}/></div></section>}

    <section className="mt-7" aria-labelledby="tmdb-history-heading"><h3 id="tmdb-history-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">REFRESH HISTORY</h3><div className="mt-4 overflow-x-auto rounded-md border border-[#E7DFD5] bg-[#FFFDF9]"><table className="w-full min-w-[680px] border-collapse text-left font-sans-clean text-sm"><thead><tr className="border-b border-[#DCD3C7] text-xs uppercase tracking-[0.12em] text-[#736B63]"><th className="px-3 py-3 font-semibold">Date</th><th className="px-3 py-3 font-semibold">Type</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Movies</th><th className="px-3 py-3 text-right font-semibold">Actors</th><th className="px-3 py-3 text-right font-semibold">Images</th><th className="px-3 py-3 text-right font-semibold">Failures</th><th className="px-3 py-3 text-right font-semibold">Duration</th></tr></thead><tbody className="divide-y divide-[#EEE7DE]">{payload.history.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-[#736B63]">No refresh runs recorded yet.</td></tr> : payload.history.map((run) => <tr key={run.id} className={run.status === 'SUCCESS' ? '' : 'bg-[#FFF5F1]'}><td className="px-3 py-3 text-xs text-[#403A34]">{dateTime(run.finishedAt || run.startedAt)}</td><td className="px-3 py-3 capitalize text-[#403A34]">{run.type}</td><td className={`px-3 py-3 font-semibold ${statusClass(run.status)}`}>{run.status}</td><td className="px-3 py-3 text-right text-[#403A34]">{run.counters.moviesSuccessful}/{run.counters.moviesAttempted}</td><td className="px-3 py-3 text-right text-[#403A34]">{run.counters.actorsSuccessful}/{run.counters.actorsAttempted}</td><td className="px-3 py-3 text-right text-[#403A34]">{run.counters.imagesSuccessful}/{run.counters.imagesAttempted}</td><td className="px-3 py-3 text-right">{run.failures.length ? <FailureDetails failures={run.failures}/> : '0'}</td><td className="px-3 py-3 text-right text-[#403A34]">{duration(run.durationMs)}</td></tr>)}</tbody></table></div></section>
    {payload.unresolvedFailureDetails.length > 0 && <section className="mt-7" aria-labelledby="tmdb-unresolved-heading"><h3 id="tmdb-unresolved-heading" className="font-heading text-xl font-semibold text-[#841818]">CURRENT UNRESOLVED FAILURES</h3><div className="mt-4 rounded-md border border-[#E7DFD5] bg-[#FFFDF9] px-4 py-4"><FailureDetails failures={payload.unresolvedFailureDetails}/></div></section>}
  </section>;
};
