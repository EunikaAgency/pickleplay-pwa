import { useEffect, useState } from 'react';
import { fetchMyPayments } from './api.js';

const STATUS_TONE = {
  pending: 'bg-tertiary-container text-on-tertiary-container',
  succeeded: 'bg-secondary-container text-on-secondary-container',
  failed: 'bg-error-container text-on-error-container',
  refunded: 'bg-primary-container text-on-primary-container',
  verified: 'bg-secondary-container text-on-secondary-container',
};

const fmt = new Intl.NumberFormat('en-US');

export default function MyPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchMyPayments({ signal: ctrl.signal })
      .then((data) => { setPayments(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">Payments</h1>
        <p className="mt-1 text-base text-on-surface-variant">
          {loading ? 'Loading…' : error ? 'Could not load payments.' : `${payments.length} transactions`}
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-2xl bg-error-container/30 p-6 text-center text-on-error-container shadow-md">
          Could not load your payments ({error.status || 'network error'}).
        </div>
      )}

      {!loading && !error && payments.length === 0 && (
        <div className="mt-12 flex flex-col items-center text-center">
          <div className="text-6xl">💳</div>
          <h2 className="mt-4 font-heading text-xl font-bold">No payments yet</h2>
          <p className="mt-2 text-base text-on-surface-variant">Your payment history will show up here.</p>
        </div>
      )}

      {payments.length > 0 && (
        <div className="space-y-3">
          {payments.map((p) => {
            const status = p.status || 'pending';
            return (
              <div key={p._id} className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-md">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high text-xl">💳</div>
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">
                      {p.method ? `${p.method} payment` : 'Payment'} {p.bookingId ? `· booking ${p.bookingId.slice(-6)}` : ''}
                    </p>
                    <p className="text-base text-on-surface-variant">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                    <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-label-sm font-bold uppercase ${STATUS_TONE[status] || STATUS_TONE.pending}`}>
                      {status}
                    </span>
                  </div>
                </div>
                <p className="font-extrabold tabular-nums whitespace-nowrap">{p.currency || 'PHP'} {fmt.format(p.amount || 0)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
