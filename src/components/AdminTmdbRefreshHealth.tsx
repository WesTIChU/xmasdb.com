import React, { useEffect, useState } from 'react';
import type { TmdbRefreshFailure, TmdbRefreshHealthPayload, TmdbRefreshRun } from '../api/types';

interface Props { onNavigate: (path: string) => void; }

function dateTime(value?: string): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) + ' UTC';
}

function duration(milliseconds?: number): string {
  if (milliseconds === undefined) return '—';
  const seconds = Math.round(milliseconds / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function statusClass(status?: string): string {
  return status === 'SUCCESS' ? 'text-[#1A3D2F]' : status === 'RUNNING' ? 'text-[#B8860B]' : 'text-[#841818]';
}

function statusLabel(status?: string): string { return status || 'UNKNOWN'; }

function Summary({ label, run }: { label: string; run?: TmdbRefreshRun }) {
  return <div className="rounded-md border border-[#DCD3C7] bg-[#FFFDF9] px-4 py-3">
    <p className="font-sans-clean text-[10px] font-semibold tracking-[0.14em] text-[#736B63]">{label}</p>
    <p className={`mt-2 text-sm font-semibold ${statusClass(run?.status)}`}>{statusLabel(run?.status)}</p>
    <p className="mt-1 text-xs text-[#736B63]">{dateTime(run?.finishedAt || run?.startedAt)} · {duration(run?.durationMs)}</p>
  </div>;
}

function MetricGrid({ items }: { items: Array<[string, string | number]> }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">{items.map(([label, value]) => <div key={label}><span className="text-[#736B63]">{label}</span><strong className="ml-1 text-[#403A34]">{typeof value === 'number' ? value.toLocaleString() : value}</strong></div>)}</div>;
}

function FailureDetails({ failures }: { failures: TmdbRefreshFailure[] }) {
  if (!failures.length) return null;
  return <details className="mt-3 text-xs">
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
  const migrationActors = payload.actors.legacyInitially === undefined ? `${payload.actors.remaining.toLocaleString()} remaining` : `${payload.actors.legacyInitially.toLocaleString()} initially · ${payload.actors.processedThisRun || 0} processed this run · ${payload.actors.remaining.toLocaleString()} remaining`;
  const migrationImages = latest?.legacyImagesBefore === undefined ? `${payload.images.posters.legacy + payload.images.backdrops.legacy + payload.images.people.legacy} remaining` : `${latest.legacyImagesBefore.toLocaleString()} initially · ${(latest.legacyImagesProcessed || 0).toLocaleString()} processed this run · ${(payload.images.posters.legacy + payload.images.backdrops.legacy + payload.images.people.legacy).toLocaleString()} remaining`;

  return <section className="mb-10 border-b border-[#E7DFD5] pb-8" aria-labelledby="tmdb-health-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="tmdb-health-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">TMDB REFRESH HEALTH</h2><p className={`mt-1 text-sm font-semibold ${payload.current.status === 'HEALTHY' ? 'text-[#1A3D2F]' : 'text-[#841818]'}`}>{payload.current.status}</p></div><p className="text-xs text-[#736B63]">5-month freshness threshold · UTC</p></div>
    {payload.current.reasons.length > 0 && <p className="mt-3 border-l-2 border-[#841818] bg-[#F7F2EB] px-3 py-2 text-xs text-[#841818]">{payload.current.reasons.join(' · ')}</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><Summary label="LAST FULL TMDB REFRESH" run={payload.lastFull} /><Summary label="LAST COMING SOON REFRESH" run={payload.lastComingSoon} /></div>
    <p className="mt-3 text-xs text-[#736B63]">Next full: <strong>{dateTime(payload.schedule.nextFull)}</strong> · Next Coming Soon: <strong>{dateTime(payload.schedule.nextComingSoon)}</strong></p>

    <section className="mt-6" aria-labelledby="tmdb-movies-health-heading"><h3 id="tmdb-movies-health-heading" className="font-heading text-lg font-semibold text-[#1A3D2F]">MOVIES</h3><div className="mt-3"><MetricGrid items={[[ 'Total', payload.movies.total ], [ 'Checked', payload.movies.checked ], [ 'Changed', payload.movies.changed ], [ 'Unchanged', payload.movies.unchanged ], [ 'Failed', payload.movies.failed ], [ 'Fresh', payload.movies.fresh ], [ 'Stale', payload.movies.stale ], [ 'Never fetched', payload.movies.neverFetched ]]}/><p className="mt-2 text-xs text-[#736B63]">Oldest successful fetch: {dateTime(payload.movies.oldestSuccessfulFetch)}</p></div></section>
    <section className="mt-6" aria-labelledby="tmdb-actors-health-heading"><h3 id="tmdb-actors-health-heading" className="font-heading text-lg font-semibold text-[#1A3D2F]">ACTORS / PEOPLE</h3><div className="mt-3"><MetricGrid items={[[ 'Total', payload.actors.total ], [ 'Fresh', payload.actors.fresh ], [ 'Stale', payload.actors.stale ], [ 'Legacy', payload.actors.legacy ], [ 'Attempted', payload.actors.attempted ], [ 'Refreshed', payload.actors.successful ], [ 'Failed', payload.actors.failed ], [ 'Skipped fresh', payload.actors.skippedFresh ]]}/><p className="mt-2 text-xs text-[#736B63]">Oldest successful fetch: {dateTime(payload.actors.oldestSuccessfulFetch)}</p><p className="mt-1 text-xs text-[#736B63]">Actor migration: {migrationActors}</p></div></section>
    <section className="mt-6" aria-labelledby="tmdb-images-health-heading"><h3 id="tmdb-images-health-heading" className="font-heading text-lg font-semibold text-[#1A3D2F]">IMAGES</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead className="border-b border-[#DCD3C7] text-[#736B63]"><tr><th className="px-2 py-2">Kind</th><th className="px-2 py-2">Total</th><th className="px-2 py-2">Fresh</th><th className="px-2 py-2">Stale</th><th className="px-2 py-2">Legacy</th><th className="px-2 py-2">Run refreshed</th></tr></thead><tbody className="divide-y divide-[#EEE7DE]">{(['posters', 'backdrops', 'people'] as const).map((kind) => { const image = payload.images[kind]; return <tr key={kind}><th className="px-2 py-2 font-medium capitalize text-[#403A34]">{kind}</th><td className="px-2 py-2">{image.total.toLocaleString()}</td><td className="px-2 py-2">{image.fresh.toLocaleString()}</td><td className="px-2 py-2">{image.stale.toLocaleString()}</td><td className="px-2 py-2">{image.legacy.toLocaleString()}</td><td className="px-2 py-2">{image.refreshedThisRun.toLocaleString()} / {image.failedThisRun.toLocaleString()} failed</td></tr>; })}</tbody></table></div><p className="mt-2 text-xs text-[#736B63]">Image migration: {migrationImages}</p></section>
    {latest && <section className="mt-6" aria-labelledby="tmdb-latest-run-heading"><h3 id="tmdb-latest-run-heading" className="font-heading text-lg font-semibold text-[#1A3D2F]">LATEST REFRESH RUN</h3><div className="mt-3 rounded-md border border-[#E7DFD5] bg-[#FFFDF9] px-4 py-3"><MetricGrid items={[[ 'Started', dateTime(latest.startedAt) ], [ 'Finished', dateTime(latest.finishedAt) ], [ 'Duration', duration(latest.durationMs) ], [ 'Movies', `${latestCounters.moviesSuccessful || 0}/${latestCounters.moviesAttempted || 0}` ], [ 'Actors', `${latestCounters.actorsSuccessful || 0}/${latestCounters.actorsAttempted || 0}` ], [ 'Images', `${latestCounters.imagesSuccessful || 0}/${latestCounters.imagesAttempted || 0}` ], [ 'Failures', latest.failures.length ], [ 'Status', latest.status ]]}/><FailureDetails failures={latest.failures}/></div></section>}
    <section className="mt-6" aria-labelledby="tmdb-history-heading"><h3 id="tmdb-history-heading" className="font-heading text-lg font-semibold text-[#1A3D2F]">FAILURE HISTORY</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="border-b border-[#DCD3C7] text-[#736B63]"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Type</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Movies</th><th className="px-2 py-2">Actors</th><th className="px-2 py-2">Images</th><th className="px-2 py-2">Failures</th><th className="px-2 py-2">Duration</th></tr></thead><tbody className="divide-y divide-[#EEE7DE]">{payload.history.map((run) => <tr key={run.id} className={run.status === 'SUCCESS' ? '' : 'bg-[#FFF5F1]'}><td className="px-2 py-2">{dateTime(run.finishedAt || run.startedAt)}</td><td className="px-2 py-2 capitalize">{run.type}</td><td className={`px-2 py-2 font-semibold ${statusClass(run.status)}`}>{run.status}</td><td className="px-2 py-2">{run.counters.moviesSuccessful}/{run.counters.moviesAttempted}</td><td className="px-2 py-2">{run.counters.actorsSuccessful}/{run.counters.actorsAttempted}</td><td className="px-2 py-2">{run.counters.imagesSuccessful}/{run.counters.imagesAttempted}</td><td className="px-2 py-2">{run.failures.length ? <FailureDetails failures={run.failures}/> : '0'}</td><td className="px-2 py-2">{duration(run.durationMs)}</td></tr>)}</tbody></table></div></section>
    {payload.unresolvedFailureDetails.length > 0 && <section className="mt-6" aria-labelledby="tmdb-unresolved-heading"><h3 id="tmdb-unresolved-heading" className="font-heading text-lg font-semibold text-[#841818]">CURRENT UNRESOLVED FAILURES</h3><div className="mt-3"><FailureDetails failures={payload.unresolvedFailureDetails}/></div></section>}
  </section>;
};
