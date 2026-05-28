import { useEffect, useState } from 'react';
import DataTable from '../../shared/components/dashboard/DataTable.jsx';
import Icon from '../../shared/components/Icon.jsx';
import { apiPatch } from '../../shared/api/client.js';
import { fetchClaims } from './api.js';

const STATUS_TONE = {
  pending: 'bg-tertiary-container text-on-tertiary-container',
  approved: 'bg-secondary-container text-on-secondary-container',
  rejected: 'bg-error-container text-on-error-container',
};

export default function ClaimsQueuePage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(new Set());

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchClaims({ signal: ctrl.signal })
      .then((data) => { setClaims(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  async function review(claimId, status) {
    setUpdating((u) => new Set(u).add(claimId));
    try {
      await apiPatch(`/api/v1/claims/${claimId}`, { status });
      setClaims((cs) => cs.map((c) => c._id === claimId ? { ...c, status } : c));
    } catch (e) {
      alert(`Could not update claim: ${e.message}`);
    } finally {
      setUpdating((u) => { const n = new Set(u); n.delete(claimId); return n; });
    }
  }

  const columns = [
    {
      key: 'venueId',
      header: 'Venue',
      render: (c) => (
        <div className="min-w-0">
          <p className="font-semibold text-on-surface">venue {(c.venueId || '').slice(-6)}</p>
          {c.proofDescription && <p className="mt-1 line-clamp-2 text-label-sm text-on-surface-variant">{c.proofDescription}</p>}
        </div>
      ),
    },
    {
      key: 'claimedByUserId',
      header: 'Claimant',
      render: (c) => <span className="text-label-sm text-on-surface-variant">user {(c.claimedByUserId || '').slice(-6) || '—'}</span>,
    },
    {
      key: 'proofDocumentUrls',
      header: 'Proof',
      render: (c) => {
        const docs = c.proofDocumentUrls || [];
        if (docs.length === 0) return <span className="text-on-surface-variant">none</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {docs.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-0.5 text-label-sm font-semibold text-primary no-underline hover:underline">
                <Icon name="attachment" size={14} />Doc {i + 1}
              </a>
            ))}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (c) => c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => {
        const s = c.status || 'pending';
        return <span className={`rounded-full px-2.5 py-0.5 text-label-sm font-bold uppercase ${STATUS_TONE[s] || STATUS_TONE.pending}`}>{s}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (c) => {
        if ((c.status || 'pending') !== 'pending') return null;
        const busy = updating.has(c._id);
        return (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => review(c._id, 'approved')}
              className="rounded-full bg-secondary-container px-3 py-1 text-label-sm font-bold uppercase text-on-secondary-container disabled:opacity-50">
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => review(c._id, 'rejected')}
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
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">Venue ownership claims</h1>
        <p className="mt-1 text-on-surface-variant">
          {loading ? 'Loading…' : `${claims.length} total`}
        </p>
      </header>

      <DataTable
        columns={columns}
        rows={claims}
        loading={loading}
        error={error}
        emptyMessage="No claims yet."
        rowKey="_id"
      />
    </div>
  );
}
