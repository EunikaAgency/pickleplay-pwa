import { useEffect, useState } from 'react';
import DataTable from '../../shared/components/dashboard/DataTable.jsx';
import Icon from '../../shared/components/Icon.jsx';
import { apiPatch } from '../../shared/api/client.js';
import { fetchAdminReviews } from './api.js';

const STATUS_TONE = {
  pending_moderation: 'bg-tertiary-container text-on-tertiary-container',
  approved: 'bg-secondary-container text-on-secondary-container',
  rejected: 'bg-error-container text-on-error-container',
  hidden: 'bg-surface-container-high text-on-surface-variant',
};

export default function ReviewQueuePage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending_moderation');
  const [updating, setUpdating] = useState(new Set());

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchAdminReviews({ status, signal: ctrl.signal })
      .then((data) => { setReviews(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [status]);

  async function moderate(reviewId, newStatus) {
    setUpdating((u) => new Set(u).add(reviewId));
    try {
      await apiPatch(`/api/v1/admin/reviews/${reviewId}`, { status: newStatus });
      // Optimistic: remove from current view
      setReviews((rs) => rs.filter((r) => r._id !== reviewId));
    } catch (e) {
      alert(`Could not ${newStatus} review: ${e.message}`);
    } finally {
      setUpdating((u) => { const n = new Set(u); n.delete(reviewId); return n; });
    }
  }

  const columns = [
    {
      key: 'rating',
      header: 'Rating',
      render: (r) => (
        <div className="flex items-center gap-1">
          <Icon name="star" size={16} filled className="text-[#2E5BFF]" />
          <span className="font-bold tabular-nums">{r.rating}</span>
        </div>
      ),
    },
    {
      key: 'text',
      header: 'Review',
      render: (r) => (
        <div className="max-w-md">
          <p className="line-clamp-3 text-base text-on-surface">{r.text || <em className="text-on-surface-variant">(no text)</em>}</p>
          <p className="mt-1 text-label-sm text-on-surface-variant">
            venue {(r.venueId || '').slice(-6)} · user {(r.userId || '').slice(-6)}
          </p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Posted',
      render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const s = r.status || 'pending_moderation';
        return <span className={`rounded-full px-2.5 py-0.5 text-label-sm font-bold uppercase ${STATUS_TONE[s] || STATUS_TONE.pending_moderation}`}>{s.replace(/_/g, ' ')}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (r) => {
        const busy = updating.has(r._id);
        return (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => moderate(r._id, 'approved')}
              className="rounded-full bg-secondary-container px-3 py-1 text-label-sm font-bold uppercase text-on-secondary-container disabled:opacity-50">
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => moderate(r._id, 'rejected')}
              className="rounded-full bg-error-container px-3 py-1 text-label-sm font-bold uppercase text-on-error-container disabled:opacity-50">
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">Review moderation</h1>
        <p className="mt-1 text-on-surface-variant">
          {loading ? 'Loading…' : `${reviews.length} ${status.replace(/_/g, ' ')}`}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-md">
        <span className="text-base font-bold uppercase tracking-wider text-on-surface-variant">Status:</span>
        <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
          {['pending_moderation', 'approved', 'rejected', 'hidden'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-base font-semibold capitalize transition-colors ${
                status === s ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={reviews}
        loading={loading}
        error={error}
        emptyMessage={`No ${status.replace(/_/g, ' ')} reviews.`}
        rowKey="_id"
      />
    </div>
  );
}
