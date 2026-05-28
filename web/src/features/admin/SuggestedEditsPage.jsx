import { useEffect, useState } from 'react';
import DataTable from '../../shared/components/dashboard/DataTable.jsx';
import { apiPatch } from '../../shared/api/client.js';
import { fetchSuggestedEdits } from './api.js';

const STATUS_TONE = {
  pending: 'bg-tertiary-container text-on-tertiary-container',
  accepted: 'bg-secondary-container text-on-secondary-container',
  rejected: 'bg-error-container text-on-error-container',
};

export default function SuggestedEditsPage() {
  const [edits, setEdits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(new Set());

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchSuggestedEdits({ signal: ctrl.signal })
      .then((data) => { setEdits(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  async function review(id, status) {
    setUpdating((u) => new Set(u).add(id));
    try {
      await apiPatch(`/api/v1/suggested-edits/${id}`, { status });
      setEdits((es) => es.map((e) => e._id === id ? { ...e, status } : e));
    } catch (e) {
      alert(`Could not update suggested edit: ${e.message}`);
    } finally {
      setUpdating((u) => { const n = new Set(u); n.delete(id); return n; });
    }
  }

  const columns = [
    {
      key: 'venueId',
      header: 'Venue',
      render: (e) => <span className="font-semibold text-on-surface">venue {(e.venueId || '').slice(-6)}</span>,
    },
    {
      key: 'editType',
      header: 'Type',
      render: (e) => <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-surface-variant">{e.editType || 'edit'}</span>,
    },
    {
      key: 'payloadJson',
      header: 'Proposed change',
      render: (e) => (
        <pre className="max-w-md overflow-hidden rounded-lg bg-surface-container-low p-2 text-label-sm text-on-surface-variant">
          {typeof e.payloadJson === 'string' ? e.payloadJson.slice(0, 200) : JSON.stringify(e.payloadJson || {}, null, 0).slice(0, 200)}
        </pre>
      ),
    },
    {
      key: 'suggestedByUserId',
      header: 'Submitted by',
      render: (e) => <span className="text-label-sm text-on-surface-variant">user {(e.suggestedByUserId || '').slice(-6) || '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'When',
      render: (e) => e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => {
        const s = e.status || 'pending';
        return <span className={`rounded-full px-2.5 py-0.5 text-label-sm font-bold uppercase ${STATUS_TONE[s] || STATUS_TONE.pending}`}>{s}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (e) => {
        if ((e.status || 'pending') !== 'pending') return null;
        const busy = updating.has(e._id);
        return (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => review(e._id, 'accepted')}
              className="rounded-full bg-secondary-container px-3 py-1 text-label-sm font-bold uppercase text-on-secondary-container disabled:opacity-50">
              Accept
            </button>
            <button type="button" disabled={busy} onClick={() => review(e._id, 'rejected')}
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
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">Suggested edits</h1>
        <p className="mt-1 text-on-surface-variant">
          {loading ? 'Loading…' : `${edits.length} total`}
        </p>
      </header>

      <DataTable
        columns={columns}
        rows={edits}
        loading={loading}
        error={error}
        emptyMessage="No suggested edits yet."
        rowKey="_id"
      />
    </div>
  );
}
