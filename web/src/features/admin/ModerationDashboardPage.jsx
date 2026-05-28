import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import StatCard from '../../shared/components/dashboard/StatCard.jsx';
import { fetchAdminReviews, fetchReviewReports, fetchClaims, fetchSuggestedEdits } from './api.js';

export default function ModerationDashboardPage() {
  const [counts, setCounts] = useState({ reviews: null, reports: null, claims: null, edits: null });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    Promise.allSettled([
      fetchAdminReviews({ signal: ctrl.signal }),
      fetchReviewReports({ signal: ctrl.signal }),
      fetchClaims({ signal: ctrl.signal }),
      fetchSuggestedEdits({ signal: ctrl.signal }),
    ]).then(([reviewsR, reportsR, claimsR, editsR]) => {
      setCounts({
        reviews: reviewsR.status === 'fulfilled' ? reviewsR.value.length : null,
        reports: reportsR.status === 'fulfilled' ? reportsR.value.length : null,
        claims: claimsR.status === 'fulfilled' ? claimsR.value.length : null,
        edits: editsR.status === 'fulfilled' ? editsR.value.length : null,
      });
      const errs = {};
      if (reviewsR.status === 'rejected') errs.reviews = reviewsR.reason;
      if (reportsR.status === 'rejected') errs.reports = reportsR.reason;
      if (claimsR.status === 'rejected') errs.claims = claimsR.reason;
      if (editsR.status === 'rejected') errs.edits = editsR.reason;
      setErrors(errs);
    }).finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const queues = [
    { id: 'reviews', label: 'Reviews', icon: 'rate_review', to: '/admin/moderation/reviews', description: 'Venue + coach reviews awaiting moderation', tone: 'primary' },
    { id: 'reports', label: 'Review reports', icon: 'flag', to: '/admin/moderation/review-reports', description: 'User-flagged reviews to triage', tone: 'tertiary' },
    { id: 'claims', label: 'Venue claims', icon: 'assignment_ind', to: '/admin/moderation/claims', description: 'Ownership claims to verify', tone: 'secondary' },
    { id: 'edits', label: 'Suggested edits', icon: 'edit_note', to: '/admin/moderation/suggested-edits', description: 'User-submitted venue corrections', tone: 'neutral' },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">Moderation queues</h1>
        <p className="mt-1 text-on-surface-variant">Open items across every moderation surface.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {queues.map((q) => (
          <Link
            key={q.id}
            to={q.to}
            className="block rounded-2xl bg-white p-5 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl no-underline"
          >
            <StatCard
              label={q.label}
              value={loading ? '…' : errors[q.id] ? '—' : counts[q.id] ?? 0}
              icon={q.icon}
              tone={q.tone}
            />
            <p className="mt-2 px-1 text-base text-on-surface-variant">{q.description}</p>
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-md">
        <h2 className="font-heading text-xl font-bold text-on-surface">How moderation works</h2>
        <p className="mt-2 text-base text-on-surface-variant">
          Each queue lists open items pulled from the API. Pick a queue from the sidebar or the cards above. For now,
          actions (approve / reject) PATCH the underlying record; future iterations will add bulk actions,
          assignment, and audit-log integration.
        </p>
      </section>
    </div>
  );
}
