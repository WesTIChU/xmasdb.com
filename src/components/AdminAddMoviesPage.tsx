import React, { useMemo, useState } from 'react';

type Brand = 'hallmark' | 'lifetime' | 'gaf';
type Status = 'collection' | 'coming-soon';
type Mode = 'single' | 'bulk';
interface PreviewItem { line: number; tmdbId?: number; brand?: Brand; status?: Status; state: 'ready' | 'existing' | 'not-found' | 'invalid'; error?: string; title?: string; originalTitle?: string; year?: string; releaseDate?: string; imdbId?: string; runtimeMinutes?: number; overview?: string; posterUrl?: string; existingBrand?: string; existingStatus?: string; selected?: boolean; }

interface AdminAddMoviesPageProps { onNavigate: (path: string) => void; }
const brandLabels: Record<Brand, string> = { hallmark: 'Hallmark', lifetime: 'Lifetime', gaf: 'Great American Family' };
const statusLabels: Record<Status, string> = { collection: 'Collection', 'coming-soon': 'Coming Soon' };

export const AdminAddMoviesPage: React.FC<AdminAddMoviesPageProps> = ({ onNavigate }) => {
  const [mode, setMode] = useState<Mode>('single');
  const [input, setInput] = useState('');
  const [defaultBrand, setDefaultBrand] = useState<Brand>('hallmark');
  const [defaultStatus, setDefaultStatus] = useState<Status>('collection');
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [baseSha, setBaseSha] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshState, setRefreshState] = useState<'idle' | 'starting' | 'started' | 'cooldown'>('idle');

  const preview = async () => {
    setBusy(true); setError(''); setMessage(''); setItems([]);
    try {
      const response = await fetch('/api/admin/movies/preview', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, input, defaultBrand, defaultStatus }) });
      const payload = await response.json().catch(() => ({})) as { error?: string; baseSha?: string; items?: PreviewItem[] };
      if (response.status === 401) return onNavigate('/admin/login/');
      if (!response.ok) throw new Error(payload.error || 'Movies could not be previewed.');
      setBaseSha(payload.baseSha || ''); setItems((payload.items || []).map((item) => ({ ...item, selected: item.state === 'ready' })));
    } catch (previewError) { setError(previewError instanceof Error ? previewError.message : 'Movies could not be previewed.'); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    const selected = items.filter((item) => item.state === 'ready' && item.selected && item.tmdbId && item.brand && item.status).map((item) => ({ tmdbId: item.tmdbId, brand: item.brand, status: item.status }));
    if (!selected.length) return setError('Select at least one movie to add.');
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/movies/commit', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: selected, baseSha }) });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; added?: number; commitSha?: string };
      if (response.status === 401) return onNavigate('/admin/login/');
      if (!response.ok) throw new Error(payload.error || 'Catalogue update failed.');
      setMessage(`${payload.message} ${payload.added} movie${payload.added === 1 ? '' : 's'} added.${payload.commitSha ? ` Commit ${payload.commitSha}.` : ''}`);
      setItems([]);
    } catch (commitError) { setError(commitError instanceof Error ? commitError.message : 'Catalogue update failed.'); }
    finally { setBusy(false); }
  };

  const readyCount = useMemo(() => items.filter((item) => item.state === 'ready' && item.selected).length, [items]);
  const refreshComingSoon = async () => {
    setRefreshState('starting'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/refresh-coming-soon', { method: 'POST', credentials: 'same-origin' });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; status?: 'started' | 'cooldown' };
      if (response.status === 401) return onNavigate('/admin/login/');
      if (payload.status === 'cooldown') { setRefreshState('cooldown'); setMessage(payload.message || 'A Coming Soon refresh was requested recently. Please try again shortly.'); return; }
      if (!response.ok) throw new Error(payload.error || 'Could not start the refresh. Please try again.');
      setRefreshState('started'); setMessage(payload.message || 'Coming Soon refresh started. Any TMDb changes will be committed automatically and deployed by Coolify.');
    } catch (refreshError) { setRefreshState('idle'); setError(refreshError instanceof Error ? refreshError.message : 'Could not start the refresh. Please try again.'); }
  };
  const setItem = (index: number, change: Partial<PreviewItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); onNavigate('/admin/login/'); };

  return <section className="py-10 sm:py-14" aria-labelledby="admin-add-heading"><div className="mx-auto max-w-3xl">
    <div className="border-b border-[#E7DFD5] pb-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 id="admin-add-heading" className="font-heading text-2xl font-semibold tracking-wide text-[#1A3D2F] sm:text-3xl">ADD MOVIES</h1><p className="mt-3 text-sm leading-6 text-[#736B63]">Add Christmas movies to the XmasDB catalogue using their TMDb IDs.</p></div><nav className="flex gap-4 text-xs font-semibold tracking-wide" aria-label="Admin navigation"><button type="button" onClick={() => onNavigate('/admin/submissions/')} className="text-[#1A3D2F] underline decoration-[#C8BFB3] underline-offset-4">SUBMISSIONS</button><button type="button" className="text-[#841818] underline underline-offset-4">ADD MOVIES</button><button type="button" onClick={() => void logout()} className="text-[#1A3D2F] underline decoration-[#C8BFB3] underline-offset-4">LOG OUT</button></nav></div></div>
    <div className="flex gap-5 border-b border-[#E7DFD5] py-4 text-sm font-semibold text-[#1A3D2F]"><button type="button" onClick={() => setMode('single')} className={mode === 'single' ? 'text-[#841818] underline underline-offset-4' : 'text-[#736B63]'}>SINGLE</button><button type="button" onClick={() => setMode('bulk')} className={mode === 'bulk' ? 'text-[#841818] underline underline-offset-4' : 'text-[#736B63]'}>BULK</button></div>
    <div className="space-y-5 pt-7"><div><label htmlFor="movie-input" className="mb-2 block text-sm font-semibold text-[#1A3D2F]">{mode === 'single' ? 'TMDb ID or movie URL' : 'TMDb IDs, one item per line'}</label>{mode === 'single' ? <input id="movie-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="1547913 or https://www.themoviedb.org/movie/..." className="w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 outline-none focus:border-[#1A3D2F] focus:ring-2 focus:ring-[#1A3D2F]/20" /> : <textarea id="movie-input" rows={8} value={input} onChange={(event) => setInput(event.target.value)} placeholder={'1547913\n1064137 | lifetime | collection'} className="w-full resize-y rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 outline-none focus:border-[#1A3D2F] focus:ring-2 focus:ring-[#1A3D2F]/20" />}</div>
      <div className="flex flex-wrap gap-5"><label className="text-sm text-[#1A3D2F]">Default brand <select value={defaultBrand} onChange={(event) => setDefaultBrand(event.target.value as Brand)} className="ml-2 rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1.5"><option value="hallmark">Hallmark</option><option value="lifetime">Lifetime</option><option value="gaf">Great American Family</option></select></label><label className="text-sm text-[#1A3D2F]">Default status <select value={defaultStatus} onChange={(event) => setDefaultStatus(event.target.value as Status)} className="ml-2 rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1.5"><option value="collection">Collection</option><option value="coming-soon">Coming Soon</option></select></label></div>
      {error && <p className="border-l-2 border-[#841818] bg-[#F7F2EB] px-4 py-3 text-sm text-[#841818]" role="alert">{error}</p>}{message && <p className="border-l-2 border-[#1A3D2F] bg-[#F7F2EB] px-4 py-3 text-sm text-[#1A3D2F]" role="status">{message}</p>}
      <button type="button" disabled={busy || !input.trim()} onClick={() => void preview()} className="rounded border border-[#1A3D2F] bg-[#1A3D2F] px-5 py-3 text-sm font-semibold tracking-wide text-[#FAF7F2] disabled:opacity-50">{busy ? 'LOADING...' : mode === 'single' ? 'PREVIEW MOVIE' : 'PREVIEW MOVIES'}</button>
    </div>
    {items.length > 0 && <div className="mt-9 divide-y divide-[#E7DFD5] border-t border-[#E7DFD5]">{items.map((item, index) => <article key={`${item.line}-${item.tmdbId || 'invalid'}`} className="py-6"><p className={`font-sans-clean text-xs font-semibold tracking-wide ${item.state === 'ready' ? 'text-[#1A3D2F]' : item.state === 'existing' ? 'text-[#B8860B]' : 'text-[#841818]'}`}>{item.state === 'ready' ? 'READY TO ADD' : item.state === 'existing' ? 'ALREADY IN XMASDB' : item.state === 'not-found' ? 'NOT FOUND' : 'INVALID INPUT'}</p><div className="mt-2 flex gap-4">{item.posterUrl && <img src={item.posterUrl} alt="" width={64} height={96} loading="lazy" className="h-24 w-16 rounded object-cover" /> }<div>{item.title && <h2 className="font-heading text-lg font-semibold text-[#1A3D2F]">{item.title}</h2>}<p className="mt-1 text-sm text-[#736B63]">{item.tmdbId ? `TMDb ${item.tmdbId}` : `Line ${item.line}`}{item.year ? ` · ${item.year}` : ''}{item.releaseDate ? ` · ${item.releaseDate}` : ''}</p>{item.originalTitle && item.originalTitle !== item.title && <p className="mt-1 text-xs text-[#736B63]">Original title: {item.originalTitle}</p>}{item.imdbId && <p className="mt-1 text-xs text-[#736B63]">IMDb: {item.imdbId}{item.runtimeMinutes ? ` · ${item.runtimeMinutes} min` : ''}</p>}</div></div>{item.overview && <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4A433B]">{item.overview}</p>}{item.error && <p className="mt-2 text-sm text-[#841818]">{item.error}</p>}{item.state === 'existing' && <p className="mt-2 text-sm text-[#736B63]">{item.existingBrand} · {item.existingStatus}</p>}{item.state === 'ready' && <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><label><input type="checkbox" checked={item.selected !== false} onChange={(event) => setItem(index, { selected: event.target.checked })} className="mr-2" />Add</label><select value={item.brand} onChange={(event) => setItem(index, { brand: event.target.value as Brand })} className="rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1.5">{(Object.keys(brandLabels) as Brand[]).map((brand) => <option key={brand} value={brand}>{brandLabels[brand]}</option>)}</select><select value={item.status} onChange={(event) => setItem(index, { status: event.target.value as Status })} className="rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1.5">{(Object.keys(statusLabels) as Status[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div>}</article>)}</div>}
    {readyCount > 0 && <button type="button" disabled={busy} onClick={() => void commit()} className="mt-7 rounded border border-[#1A3D2F] bg-[#1A3D2F] px-5 py-3 text-sm font-semibold tracking-wide text-[#FAF7F2] disabled:opacity-50">ADD {readyCount} MOVIE{readyCount === 1 ? '' : 'S'}</button>}
   <div className="mt-10 border-t border-[#E7DFD5] pt-7" aria-labelledby="coming-soon-refresh-heading"><h2 id="coming-soon-refresh-heading" className="font-heading text-lg font-semibold tracking-wide text-[#1A3D2F]">COMING SOON REFRESH</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#736B63]">Check all Coming Soon movies for updated TMDb metadata and artwork.</p><button type="button" disabled={refreshState === 'starting' || refreshState === 'started'} onClick={() => void refreshComingSoon()} className="mt-4 rounded border border-[#841818] px-5 py-3 text-sm font-semibold tracking-wide text-[#841818] disabled:opacity-50">{refreshState === 'starting' ? 'STARTING REFRESH...' : refreshState === 'started' ? 'REFRESH STARTED' : 'REFRESH COMING SOON'}</button></div>
   </div></section>;
};
