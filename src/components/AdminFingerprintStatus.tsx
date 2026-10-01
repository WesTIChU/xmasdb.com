import React, { useEffect, useState } from 'react';
import type { FingerprintStatusPayload } from '../api/types';

interface AdminFingerprintStatusProps {
  onNavigate: (path: string) => void;
}

function dateTime(value: string | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusClass(status: string): string {
  return status === 'SUCCESS' || status === 'classified' ? 'text-[#1A3D2F]' : status === 'PARTIAL' || status === 'no-match' || status === 'insufficient-data' ? 'text-[#B8860B]' : 'text-[#841818]';
}

export const AdminFingerprintStatus: React.FC<AdminFingerprintStatusProps> = ({ onNavigate }) => {
  const [payload, setPayload] = useState<FingerprintStatusPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/fingerprint-status', { credentials: 'same-origin' })
      .then(async (response) => {
        const next = await response.json().catch(() => null) as FingerprintStatusPayload | { error?: string } | null;
        if (response.status === 401) {
          onNavigate('/admin/login/');
          return;
        }
        if (!response.ok || !next || !('catalogue' in next)) throw new Error((next as { error?: string } | null)?.error || 'Christmas Ingredients status could not be loaded.');
        setPayload(next);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Christmas Ingredients status could not be loaded.'));
  }, [onNavigate]);

  if (!payload) return <section className="mb-10 border-b border-[#E7DFD5] pb-8 text-sm text-[#736B63]" aria-labelledby="fingerprint-status-heading"><h2 id="fingerprint-status-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">CHRISTMAS INGREDIENTS / JEV</h2><p className="mt-3">{error || 'Loading Jev status...'}</p></section>;

  const run = payload.lastRun;
  const catalogueCards = [
    ['CATALOGUE MOVIES', payload.catalogue.totalMovies],
    ['WITH INGREDIENTS', payload.catalogue.moviesWithIngredients],
    ['WITHOUT INGREDIENTS', payload.catalogue.moviesWithoutIngredients],
  ] as const;
  const runCards = [
    ['PROCESSED LAST RUN', run?.processed || 0],
    ['CLASSIFIED', run?.classified || 0],
    ['NO MATCH', run?.noMatch || 0],
    ['INSUFFICIENT DATA', run?.insufficientData || 0],
    ['FAILED', run?.failed || 0],
    ['NEW ASSIGNMENTS', run?.newAssignmentsApplied || 0],
    ['SKIPPED EXISTING', run?.skippedExistingAssignments || 0],
  ] as const;

  return <section className="mb-10 border-b border-[#E7DFD5] pb-8" aria-labelledby="fingerprint-status-heading">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 id="fingerprint-status-heading" className="font-heading text-xl font-semibold text-[#1A3D2F]">CHRISTMAS INGREDIENTS / JEV</h2><p className="mt-1 text-sm text-[#736B63]">Private classifier health and recent processing results.</p></div>
      {run && <p className={`font-sans-clean text-sm font-semibold ${statusClass(run.status)}`}>{run.status}</p>}
    </div>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{catalogueCards.map(([label, value]) => <div key={label} className="rounded-md border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-3"><p className="font-sans-clean text-[10px] font-semibold tracking-[0.12em] text-[#736B63]">{label}</p><p className="mt-1 font-heading text-xl font-semibold text-[#1A3D2F]">{value.toLocaleString()}</p></div>)}</div>
    {!run ? <p className="mt-4 text-sm text-[#736B63]">No automated Jev run has been recorded yet.</p> : <>
      <p className="mt-3 text-sm text-[#736B63]">Last run: {dateTime(run.finishedAt)} · started {dateTime(run.startedAt)}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">{runCards.map(([label, value]) => <div key={label} className="rounded-md border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-3"><p className="font-sans-clean text-[10px] font-semibold tracking-[0.12em] text-[#736B63]">{label}</p><p className="mt-1 font-heading text-xl font-semibold text-[#1A3D2F]">{value.toLocaleString()}</p></div>)}</div>
      <div className="mt-6 overflow-x-auto rounded-md border border-[#E7DFD5] bg-[#FFFDF9]"><table className="w-full min-w-[620px] border-collapse text-left font-sans-clean text-sm"><thead><tr className="border-b border-[#DCD3C7] text-xs uppercase tracking-[0.12em] text-[#736B63]"><th className="px-3 py-3">Movie</th><th className="px-3 py-3">Result</th><th className="px-3 py-3">Ingredients</th><th className="px-3 py-3">Processed</th></tr></thead><tbody className="divide-y divide-[#EEE7DE]">{run.recentMovies.map((movie) => <tr key={`${movie.movieId}-${movie.processedAt}`}><th scope="row" className="px-3 py-3 font-medium text-[#1A3D2F]">{movie.title}</th><td className={`px-3 py-3 font-semibold ${statusClass(movie.status)}`}>{movie.status}</td><td className="px-3 py-3 text-[#403A34]">{movie.fingerprints.length ? movie.fingerprints.join(', ') : '—'}</td><td className="px-3 py-3 text-xs text-[#736B63]">{dateTime(movie.processedAt)}</td></tr>)}{run.recentMovies.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-[#736B63]">No movies were processed in the last run.</td></tr>}</tbody></table></div>
    </>}
  </section>;
};
