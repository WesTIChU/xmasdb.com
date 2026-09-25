import React, { useEffect, useMemo, useState } from 'react';
import type { FeedStatisticsPayload, FeedStatisticsRow } from '../api/types';
import { AdminTmdbRefreshHealth } from './AdminTmdbRefreshHealth';

interface AdminFeedStatisticsPageProps {
  onNavigate: (path: string) => void;
}

function formatLastPulled(value: string | undefined): string {
  if (!value) return 'Never';
  const elapsed = Math.max(0, Date.now() - Date.parse(value));
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function AdminNavigation({ onNavigate, onLogout }: AdminFeedStatisticsPageProps & { onLogout: () => void }) {
  return (
    <nav className="flex flex-wrap gap-4 text-xs font-semibold tracking-wide" aria-label="Admin navigation">
      <button type="button" onClick={() => onNavigate('/admin/submissions/')} className="text-[#1A3D2F] underline decoration-[#C8BFB3] underline-offset-4 hover:text-[#841818]">SUBMISSIONS</button>
      <button type="button" onClick={() => onNavigate('/admin/movies/add/')} className="text-[#1A3D2F] underline decoration-[#C8BFB3] underline-offset-4 hover:text-[#841818]">ADD MOVIES</button>
      <button type="button" className="text-[#841818] underline underline-offset-4">FEED STATISTICS</button>
      <button type="button" onClick={onLogout} className="text-[#1A3D2F] underline decoration-[#C8BFB3] underline-offset-4 hover:text-[#841818]">LOG OUT</button>
    </nav>
  );
}

function StatisticsTable({ rows, emptyMessage }: { rows: FeedStatisticsRow[]; emptyMessage: string }) {
  if (rows.length === 0) return <p className="py-8 text-center font-body text-sm text-[#736B63]">{emptyMessage}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-left font-sans-clean text-sm">
        <thead>
          <tr className="border-b border-[#DCD3C7] text-xs uppercase tracking-[0.12em] text-[#736B63]">
            <th className="px-3 py-3 font-semibold">Feed</th>
            <th className="px-3 py-3 text-right font-semibold">Total</th>
            <th className="px-3 py-3 text-right font-semibold">Today</th>
            <th className="px-3 py-3 text-right font-semibold">7 Days</th>
            <th className="px-3 py-3 text-right font-semibold">30 Days</th>
            <th className="px-3 py-3 text-right font-semibold">Last Pull</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEE7DE]">
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row" className="px-3 py-3 font-medium text-[#1A3D2F]">{row.name}</th>
              <td className="px-3 py-3 text-right text-[#403A34]">{row.totalPulls}</td>
              <td className="px-3 py-3 text-right text-[#403A34]">{row.pullsToday}</td>
              <td className="px-3 py-3 text-right text-[#403A34]">{row.pullsLast7Days}</td>
              <td className="px-3 py-3 text-right text-[#403A34]">{row.pullsLast30Days}</td>
              <td className="px-3 py-3 text-right text-xs text-[#736B63]">{formatLastPulled(row.lastPulledAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const AdminFeedStatisticsPage: React.FC<AdminFeedStatisticsPageProps> = ({ onNavigate }) => {
  const [payload, setPayload] = useState<FeedStatisticsPayload | null>(null);
  const [actorSearch, setActorSearch] = useState('');
  const [actorPage, setActorPage] = useState(1);
  const [error, setError] = useState('');
  const actorPageSize = 25;
  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    onNavigate('/admin/login/');
  };

  useEffect(() => {
    fetch('/api/admin/feed-statistics', { credentials: 'same-origin' })
      .then(async (response) => {
        const nextPayload = await response.json().catch(() => null) as FeedStatisticsPayload | { error?: string } | null;
        if (response.status === 401) {
          onNavigate('/admin/login/');
          return;
        }
        if (!response.ok || !nextPayload || !('feeds' in nextPayload)) throw new Error((nextPayload as { error?: string } | null)?.error || 'Feed statistics could not be loaded.');
        setPayload(nextPayload);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Feed statistics could not be loaded.'));
  }, [onNavigate]);

  const collections = payload?.feeds.filter((feed) => feed.type === 'collection') || [];
  const years = payload?.feeds.filter((feed) => feed.type === 'year') || [];
  const filteredActors = useMemo(() => {
    const query = actorSearch.trim().toLowerCase();
    return (payload?.feeds.filter((feed) => feed.type === 'actor') || []).filter((feed) => !query || feed.name.toLowerCase().includes(query));
  }, [actorSearch, payload]);
  const visibleActors = filteredActors.slice((actorPage - 1) * actorPageSize, actorPage * actorPageSize);
  const actorPages = Math.ceil(filteredActors.length / actorPageSize);

  if (!payload) return <div className="py-24 text-center font-body text-[#736B63]" aria-live="polite">{error || 'Loading feed statistics...'}</div>;

  const summaryCards = [
    ['TOTAL FEED PULLS', payload.summary.totalPulls],
    ['TODAY', payload.summary.pullsToday],
    ['LAST 7 DAYS', payload.summary.pullsLast7Days],
    ['LAST 30 DAYS', payload.summary.pullsLast30Days],
  ] as const;

  return (
    <section className="py-10 sm:py-14" aria-labelledby="admin-feed-statistics-heading">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E7DFD5] pb-6">
          <div>
            <h1 id="admin-feed-statistics-heading" className="font-heading text-2xl font-semibold tracking-wide text-[#1A3D2F] sm:text-3xl">FEED STATISTICS</h1>
            <p className="mt-3 font-sans-clean text-xs tracking-wide text-[#736B63]">Successful public JSON feed pulls only. No visitor or installation tracking.</p>
          </div>
          <AdminNavigation onNavigate={onNavigate} onLogout={() => void logout()} />
        </div>

        <AdminTmdbRefreshHealth onNavigate={onNavigate} />

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {summaryCards.map(([label, value]) => (
            <div key={label} className="rounded-md border border-[#DCD3C7] bg-[#FFFDF9] px-4 py-4">
              <p className="font-sans-clean text-[10px] font-semibold tracking-[0.14em] text-[#736B63]">{label}</p>
              <p className="mt-2 font-heading text-2xl font-semibold text-[#1A3D2F]">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        <section className="mt-10" aria-labelledby="collection-feed-statistics-heading">
          <h2 id="collection-feed-statistics-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">Collection Feeds</h2>
          <div className="mt-4 rounded-md border border-[#E7DFD5] bg-[#FFFDF9]"><StatisticsTable rows={collections} emptyMessage="No collection feeds configured." /></div>
        </section>

        <section className="mt-10" aria-labelledby="year-feed-statistics-heading">
          <h2 id="year-feed-statistics-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">Year Feeds</h2>
          <div className="mt-4 rounded-md border border-[#E7DFD5] bg-[#FFFDF9]"><StatisticsTable rows={years} emptyMessage="No year feeds have been pulled yet." /></div>
        </section>

        <section className="mt-10" aria-labelledby="actor-feed-statistics-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="actor-feed-statistics-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">Actor Feeds</h2>
            {filteredActors.length > 0 && <label className="font-sans-clean text-xs text-[#736B63]">Search actors <input value={actorSearch} onChange={(event) => { setActorSearch(event.target.value); setActorPage(1); }} className="ml-2 w-44 rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1.5 text-[#403A34] outline-none focus:border-[#1A3D2F]" /></label>}
          </div>
          <div className="mt-4 rounded-md border border-[#E7DFD5] bg-[#FFFDF9]"><StatisticsTable rows={visibleActors} emptyMessage={actorSearch ? 'No actor feeds match that search.' : 'No actor feeds have been pulled yet.'} /></div>
          {actorPages > 1 && <div className="mt-4 flex items-center justify-between font-sans-clean text-xs text-[#736B63]"><span>Page {actorPage} of {actorPages}</span><div className="flex gap-3"><button type="button" disabled={actorPage === 1} onClick={() => setActorPage((page) => page - 1)} className="underline underline-offset-4 disabled:opacity-40">Previous</button><button type="button" disabled={actorPage === actorPages} onClick={() => setActorPage((page) => page + 1)} className="underline underline-offset-4 disabled:opacity-40">Next</button></div></div>}
        </section>
      </div>
    </section>
  );
};
