import { useEffect, useState } from 'react';
import DataTable from '../../shared/components/dashboard/DataTable.jsx';
import { apiPatch } from '../../shared/api/client.js';
import { fetchReviewReports } from './api.js';

export default function ReviewReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(new Set());

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchReviewReports({ signal: ctrl.signal })
      .then((data) => { setReports(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  async function resolve(reportId, resolution) {
    setUpdating((u) => new Set(u).add(reportId));
    try {
      await apiPatch(`/api/v1/admin/reports/${reportId}`, { status: resolution });
      setReports((rs) => rs.filter((r) => r._id !== reportId));
    } catch (e) {
      alert(`Could not resolve report: ${e.message}`);
    } finally {
      setUpdating((u) => { const n = new Set(u); n.delete(reportId); return n; });
    }
  }

  const columns = [
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => (
        <div className="max-w-md">
          <p className="font-semibold text-on-surface">{r.reason || '—'}</p>
          {r.details && <p className="mt-1 line-clamp-2 text-label-sm text-on-surface-variant">{r.details}</p>}
        </div>
      ),
    },
    {
      key: 'reviewId',
      header: 'Reported review',
      render: (r) => <span className="text-label-sm text-on-surface-variant">{(r.reviewId || '').slice(-6) || '—'}</span>,
    },
    {
      key: 'reporterUserId',
      header: 'Reporter',
      render: (r) => <span className="text-label-sm text-on-surface-variant">{(r.reporterUserId || '').slice(-6) || '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Reported',
      render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
    },
    {
      key: 'actions',
      header: '',
      render: (r) => {
        const busy = updating.has(r._id);
        return (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => resolve(r._id, 'resolved')}
              className="rounded-full bg-secondary-container px-3 py-1 text-label-sm font-bold uppercase text-on-secondary-container disabled:opacity-50">
              Resolve
            </button>
            <button type="button" disabled={busy} onClick={() => resolve(r._id, 'dismissed')}
              className="rounded-full bg-surface-container-high px-3 py-1 text-label-sm font-bold uppercase text-on-surface-variant disabled:opacity-50">
              Dismiss
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">Review reports</h1>
        <p className="mt-1 text-on-surface-variant">
          {loading ? 'Loading…' : `${reports.length} open reports`}
        </p>
      </header>

      <DataTable
        columns={columns}
        rows={reports}
        loading={loading}
        error={error}
        emptyMessage="No open reports. 🎉"
        rowKey="_id"
      />
    </div>
  );
}
