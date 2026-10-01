import React, { useEffect, useState } from 'react';

interface MovieResult { id: string; title: string; year: number; network: string; tmdbId: number; }
interface MovieRecord extends MovieResult { brandId: string; releaseDate: string; synopsis: string; runtimeMinutes?: number; voteAverage?: number; director?: string; writers: string[]; imdbId?: string; posterUrl: string; backdropUrl?: string; slug: string; }
interface Props { onNavigate: (path: string) => void; }

const fields = [
  ['title', 'Title'], ['brandId', 'Network'], ['releaseDate', 'Release date'], ['runtimeMinutes', 'Runtime (minutes)'],
  ['voteAverage', 'Rating (0–10)'], ['director', 'Director'], ['imdbId', 'IMDb ID'], ['tmdbId', 'TMDb ID'],
  ['posterUrl', 'Poster path'], ['backdropUrl', 'Backdrop path'],
] as const;

function displayNetwork(value: string): string { return value === 'gaf' ? 'Great American Family' : value === 'uptv' ? 'UPtv' : value[0].toUpperCase() + value.slice(1); }

export const AdminMoviesPage: React.FC<Props> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieResult[]>([]);
  const [movie, setMovie] = useState<MovieRecord | null>(null);
  const [baseSha, setBaseSha] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteReady, setDeleteReady] = useState(false);

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, credentials: 'same-origin' });
    const payload = await response.json().catch(() => ({})) as Record<string, any>;
    if (response.status === 401) { onNavigate('/admin/login/'); throw new Error('Your admin session has expired.'); }
    if (!response.ok) throw new Error(payload.error || 'Admin movie request failed.');
    return payload;
  };

  const search = async () => {
    setBusy(true); setError('');
    try { const payload = await request(`/api/admin/movies?q=${encodeURIComponent(query)}`); setResults(payload.movies || []); }
    catch (searchError) { setError(searchError instanceof Error ? searchError.message : 'Movies could not be loaded.'); }
    finally { setBusy(false); }
  };

  useEffect(() => { void search(); }, []);

  const openMovie = async (id: string) => {
    setBusy(true); setError(''); setMessage(''); setDeleteReady(false);
    try {
      const payload = await request('/api/admin/movies/edit/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: id }) });
      const next = payload.movie as MovieRecord;
      setMovie(next); setBaseSha(payload.baseSha || '');
      setForm({ title: next.title, brandId: next.brandId, releaseDate: next.releaseDate, synopsis: next.synopsis, runtimeMinutes: next.runtimeMinutes === undefined ? '' : String(next.runtimeMinutes), voteAverage: next.voteAverage === undefined ? '' : String(next.voteAverage), director: next.director || '', writers: next.writers.join('\n'), imdbId: next.imdbId || '', tmdbId: String(next.tmdbId), posterUrl: next.posterUrl, backdropUrl: next.backdropUrl || '' });
    } catch (openError) { setError(openError instanceof Error ? openError.message : 'Movie could not be loaded.'); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!movie) return;
    setBusy(true); setError(''); setMessage('');
    try { const payload = await request('/api/admin/movies/edit/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, brand: form.brandId, id: movie.id, baseSha }) }); setMessage(payload.message || 'Movie updated.'); setMovie(null); await search(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Movie could not be updated.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!movie || !deleteReady) return;
    setBusy(true); setError('');
    try { const payload = await request('/api/admin/movies/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: movie.id, baseSha, confirm: true }) }); setMessage(payload.message || 'Movie deleted.'); setMovie(null); setDeleteReady(false); await search(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Movie could not be deleted.'); }
    finally { setBusy(false); }
  };

  const changed = movie ? [...fields.map(([key, label]) => [key, label] as const), ['synopsis', 'Synopsis'] as const, ['writers', 'Writers'] as const].filter(([key]) => String(form[key] ?? '') !== String(key === 'writers' ? movie.writers.join('\n') : (movie as any)[key] ?? '')).map(([, label]) => label) : [];

  return <section className="py-10 sm:py-14" aria-labelledby="admin-movies-heading"><div className="mx-auto max-w-4xl">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E7DFD5] pb-6"><div><h1 id="admin-movies-heading" className="font-heading text-2xl font-semibold tracking-wide text-[#1A3D2F] sm:text-3xl">MOVIES</h1><p className="mt-3 text-sm leading-6 text-[#736B63]">Search and manage the canonical XmasDB movie catalogue.</p></div><nav className="flex flex-wrap gap-4 text-xs font-semibold tracking-wide" aria-label="Admin navigation"><button type="button" onClick={() => onNavigate('/admin/submissions/')} className="text-[#1A3D2F] underline underline-offset-4">SUBMISSIONS</button><button type="button" onClick={() => onNavigate('/admin/feed-statistics/')} className="text-[#1A3D2F] underline underline-offset-4">FEED STATISTICS</button><button type="button" onClick={() => onNavigate('/admin/movies/add/')} className="text-[#1A3D2F] underline underline-offset-4">ADD MOVIES</button><button type="button" onClick={() => void request('/api/admin/logout', { method: 'POST' }).then(() => onNavigate('/admin/login/'))} className="text-[#1A3D2F] underline underline-offset-4">LOG OUT</button></nav></div>
    {error && <p className="mt-5 border-l-2 border-[#841818] bg-[#F7F2EB] px-4 py-3 text-sm text-[#841818]" role="alert">{error}</p>}{message && <p className="mt-5 border-l-2 border-[#1A3D2F] bg-[#F7F2EB] px-4 py-3 text-sm text-[#1A3D2F]" role="status">{message}</p>}
    {!movie ? <><form className="mt-7 flex gap-3" onSubmit={(event) => { event.preventDefault(); void search(); }}><label htmlFor="admin-movie-search" className="sr-only">Search movies by title</label><input id="admin-movie-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search movie titles" className="min-w-0 flex-1 rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 outline-none focus:border-[#1A3D2F]" /><button type="submit" disabled={busy} className="rounded border border-[#1A3D2F] bg-[#1A3D2F] px-4 py-2 text-sm font-semibold text-[#FAF7F2] disabled:opacity-50">SEARCH</button></form><div className="mt-6 divide-y divide-[#E7DFD5] border-t border-[#E7DFD5]">{results.map((entry) => <button key={entry.id} type="button" onClick={() => void openMovie(entry.id)} className="block w-full py-4 text-left hover:bg-[#F7F2EB]"><span className="font-heading text-lg font-semibold text-[#1A3D2F]">{entry.title}</span><span className="mt-1 block text-sm text-[#736B63]">{entry.year} · {displayNetwork(entry.network)} · TMDb {entry.tmdbId}</span></button>)}{!results.length && <p className="py-8 text-sm text-[#736B63]">No movies found.</p>}</div></> : <div className="mt-7">
      <button type="button" onClick={() => setMovie(null)} className="text-sm font-semibold text-[#1A3D2F] underline">← Back to movies</button><h2 className="mt-5 font-heading text-xl font-semibold text-[#1A3D2F]">EDIT MOVIE</h2><p className="mt-2 text-sm text-[#736B63]">{movie.title} · {movie.year} · {displayNetwork(movie.brandId)} · ID preserved: {movie.id}</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="text-sm font-semibold text-[#1A3D2F]">{label}<input value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-2 w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 font-normal outline-none focus:border-[#1A3D2F]" /></label>)}<label className="text-sm font-semibold text-[#1A3D2F] sm:col-span-2">Synopsis<textarea value={form.synopsis || ''} onChange={(event) => setForm({ ...form, synopsis: event.target.value })} rows={6} className="mt-2 w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 font-normal outline-none focus:border-[#1A3D2F]" /></label><label className="text-sm font-semibold text-[#1A3D2F] sm:col-span-2">Writers<textarea value={form.writers || ''} onChange={(event) => setForm({ ...form, writers: event.target.value })} rows={3} placeholder="One writer per line" className="mt-2 w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 font-normal outline-none focus:border-[#1A3D2F]" /></label></div>
      <div className="mt-7 border-t border-[#E7DFD5] pt-6"><h3 className="font-heading text-lg font-semibold text-[#1A3D2F]">CHANGE SUMMARY</h3><p className="mt-2 text-sm text-[#736B63]">{changed.length ? changed.join(' · ') : 'No changes yet.'}</p><button type="button" disabled={busy || !changed.length} onClick={() => void save()} className="mt-5 rounded border border-[#1A3D2F] bg-[#1A3D2F] px-5 py-3 text-sm font-semibold text-[#FAF7F2] disabled:opacity-50">SAVE CHANGES</button></div>
      <div className="mt-10 border-t border-[#E7DFD5] pt-6"><h3 className="font-heading text-lg font-semibold text-[#841818]">DELETE MOVIE</h3><p className="mt-2 text-sm leading-6 text-[#736B63]">This removes <strong>{movie.title}</strong> ({movie.year}, {displayNetwork(movie.brandId)}) from XmasDB. The movie’s Christmas Ingredient assignment will be removed. Existing artwork will be retained safely.</p><label className="mt-4 block text-sm text-[#403A34]"><input type="checkbox" checked={deleteReady} onChange={(event) => setDeleteReady(event.target.checked)} className="mr-2" />I understand this permanently removes the movie from the canonical catalogue.</label><button type="button" disabled={busy || !deleteReady} onClick={() => void remove()} className="mt-4 rounded border border-[#841818] px-5 py-3 text-sm font-semibold text-[#841818] disabled:opacity-50">DELETE MOVIE</button></div>
    </div>}
  </div></section>;
};
