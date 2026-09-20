import React, { useEffect, useState } from 'react';

type SubmissionStatus = 'new' | 'resolved';
type SubmissionFilter = SubmissionStatus | 'all';

interface AdminSubmission {
  id: string;
  createdAt: string;
  status: SubmissionStatus;
  type: 'missing-movie' | 'correction' | 'other';
  movieTitle: string;
  message: string;
  name?: string;
  email?: string;
}

interface AdminSubmissionsPayload {
  submissions: AdminSubmission[];
  counts: { new: number; resolved: number; total: number };
}

interface AdminSubmissionsPageProps {
  onNavigate: (path: string) => void;
}

const typeLabels: Record<AdminSubmission['type'], string> = {
  'missing-movie': 'MISSING MOVIE',
  correction: 'ERROR OR CORRECTION',
  other: 'OTHER',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export const AdminSubmissionsPage: React.FC<AdminSubmissionsPageProps> = ({ onNavigate }) => {
  const [payload, setPayload] = useState<AdminSubmissionsPayload | null>(null);
  const [filter, setFilter] = useState<SubmissionFilter>('new');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSubmissions = async () => {
    setError('');
    const response = await fetch('/api/admin/submissions', { credentials: 'same-origin' });
    if (response.status === 401) {
      onNavigate('/admin/login/');
      return;
    }
    const nextPayload = await response.json().catch(() => null) as AdminSubmissionsPayload | { error?: string } | null;
    if (!response.ok || !nextPayload || !('submissions' in nextPayload)) throw new Error((nextPayload as { error?: string } | null)?.error || 'Submissions could not be loaded.');
    setPayload(nextPayload);
  };

  useEffect(() => {
    loadSubmissions().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Submissions could not be loaded.'));
  }, []);

  const updateStatus = async (submission: AdminSubmission) => {
    setBusyId(submission.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/submissions/${encodeURIComponent(submission.id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: submission.status === 'new' ? 'resolved' : 'new' }),
      });
      if (!response.ok) throw new Error('Submission could not be updated.');
      await loadSubmissions();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Submission could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteSubmission = async (submission: AdminSubmission) => {
    if (!window.confirm(`Delete the submission for "${submission.movieTitle || 'this message'}"?`)) return;
    setBusyId(submission.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/submissions/${encodeURIComponent(submission.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Submission could not be deleted.');
      await loadSubmissions();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Submission could not be deleted.');
    } finally {
      setBusyId(null);
    }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    onNavigate('/admin/login/');
  };

  if (!payload) {
    return <div className="py-24 text-center font-body text-[#736B63]" aria-live="polite">{error || 'Loading submissions...'}</div>;
  }

  const visibleSubmissions = payload.submissions.filter((submission) => filter === 'all' || submission.status === filter);
  const emptyMessage = payload.submissions.length === 0
    ? 'No submissions yet.'
    : filter === 'new'
      ? 'No new submissions. Christmas is saved.'
      : 'No resolved submissions yet.';

  return (
    <section className="py-10 sm:py-14" aria-labelledby="admin-submissions-heading">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E7DFD5] pb-6">
          <div>
            <h1 id="admin-submissions-heading" className="font-heading text-2xl font-semibold tracking-wide text-[#1A3D2F] sm:text-3xl">XMASDB SUBMISSIONS</h1>
            <p className="mt-3 font-sans-clean text-xs tracking-wide text-[#736B63]">NEW · {payload.counts.new} &nbsp;&nbsp; RESOLVED · {payload.counts.resolved} &nbsp;&nbsp; TOTAL · {payload.counts.total}</p>
          </div>
          <button type="button" onClick={() => void logout()} className="text-xs font-semibold tracking-wide text-[#1A3D2F] underline decoration-[#C8BFB3] underline-offset-4 hover:text-[#841818]">LOG OUT</button>
        </div>

        <div className="flex gap-4 border-b border-[#E7DFD5] py-4 text-sm font-semibold text-[#1A3D2F]" role="group" aria-label="Submission filters">
          {(['new', 'resolved', 'all'] as const).map((option) => (
            <button key={option} type="button" onClick={() => setFilter(option)} className={filter === option ? 'text-[#841818] underline underline-offset-4' : 'text-[#736B63] hover:text-[#1A3D2F]'}>
              {option === 'all' ? 'All' : option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>

        {error && <p className="mt-5 border-l-2 border-[#841818] bg-[#F7F2EB] px-4 py-3 text-sm text-[#841818]" role="alert">{error}</p>}

        {visibleSubmissions.length === 0 ? (
          <p className="py-12 text-center font-body text-[#736B63]">{emptyMessage}</p>
        ) : (
          <div className="divide-y divide-[#E7DFD5]">
            {visibleSubmissions.map((submission) => (
              <article key={submission.id} className="py-7">
                <p className="font-sans-clean text-xs font-semibold tracking-wide text-[#841818]">{typeLabels[submission.type]} · {submission.status.toUpperCase()}</p>
                {submission.movieTitle && <h2 className="mt-2 font-heading text-lg font-semibold text-[#1A3D2F]">{submission.movieTitle}</h2>}
                <p className="mt-3 whitespace-pre-wrap font-body leading-7 text-[#4A433B]">{submission.message}</p>
                {(submission.name || submission.email) && <p className="mt-3 font-sans-clean text-xs leading-6 text-[#736B63]">{submission.name && <span>{submission.name}</span>}{submission.name && submission.email && <span> · </span>}{submission.email && <span>{submission.email}</span>}</p>}
                <p className="mt-2 font-sans-clean text-xs text-[#8A8178]">Submitted {formatDate(submission.createdAt)}</p>
                <div className="mt-4 flex gap-4 text-xs font-semibold tracking-wide text-[#1A3D2F]">
                  <button type="button" disabled={busyId === submission.id} onClick={() => void updateStatus(submission)} className="underline decoration-[#C8BFB3] underline-offset-4 hover:text-[#841818] disabled:opacity-50">{submission.status === 'new' ? 'MARK RESOLVED' : 'MARK AS NEW'}</button>
                  <button type="button" disabled={busyId === submission.id} onClick={() => void deleteSubmission(submission)} className="underline decoration-[#C8BFB3] underline-offset-4 hover:text-[#841818] disabled:opacity-50">DELETE</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
