import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { OwnerStat } from './OwnerStat';
import { CompletenessMeter, type CompletenessCheck } from './CompletenessMeter';
import { listCourts, getHours, listFaqs, getReviews, type OwnerVenueDetail } from '../../shared/lib/api';

interface VenueOverviewTabProps {
  venue: OwnerVenueDetail;
  venueId: string;
  onOpenTab: (tab: string) => void;
}

interface Counts {
  courts: number | null;
  hoursDays: number | null;
  faqs: number | null;
  reviews: number | null;
  rating: number | null;
}

const QUICK_ACTIONS = [
  { tab: 'listing', icon: 'storefront', label: 'Edit listing details' },
  { tab: 'hours', icon: 'clock', label: 'Set hours & closures' },
  { tab: 'courts', icon: 'paddle', label: 'Manage courts' },
  { tab: 'reviews', icon: 'star', label: 'Reply to reviews' },
  { tab: 'faqs', icon: 'help', label: 'Edit FAQs' },
  { tab: 'photos', icon: 'camera', label: 'Manage photos' },
];

// At-a-glance landing for one venue: counts from the sub-resource endpoints
// (which also feed extra checklist rows on the meter) + quick actions.
export function VenueOverviewTab({ venue, venueId, onOpenTab }: VenueOverviewTabProps) {
  const [counts, setCounts] = useState<Counts>({ courts: null, hoursDays: null, faqs: null, reviews: null, rating: null });

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    Promise.allSettled([listCourts(venueId), getHours(venueId), listFaqs(venueId), getReviews(venueId)]).then(
      ([courts, hours, faqs, reviews]) => {
        if (cancelled) return;
        setCounts({
          courts: courts.status === 'fulfilled' ? courts.value.length : 0,
          hoursDays: hours.status === 'fulfilled' ? hours.value.filter((h) => !h.isClosed && h.openTime).length : 0,
          faqs: faqs.status === 'fulfilled' ? faqs.value.length : 0,
          reviews: reviews.status === 'fulfilled' ? reviews.value.count : 0,
          rating: reviews.status === 'fulfilled' ? reviews.value.rating : null,
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  const extra: CompletenessCheck[] = [
    { label: 'At least one court', done: (counts.courts ?? 0) > 0 },
    { label: 'Operating hours set', done: (counts.hoursDays ?? 0) > 0 },
    { label: 'At least one FAQ', done: (counts.faqs ?? 0) > 0 },
  ];
  const fmt = (n: number | null) => (n == null ? '—' : n);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <OwnerStat label="Courts" value={fmt(counts.courts)} icon="paddle" tone="primary" />
        <OwnerStat label="Open days/wk" value={fmt(counts.hoursDays)} icon="clock" tone="lime" />
        <OwnerStat label="Reviews" value={fmt(counts.reviews)} icon="star" tone="coral" />
        <OwnerStat label="Avg rating" value={counts.rating != null ? counts.rating : '—'} icon="star" tone="neutral" />
      </div>

      <CompletenessMeter venue={venue} extra={extra} />

      <div>
        <div className="hd-3 mb-2.5">Quick actions</div>
        <div className="set-list">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.tab} type="button" className="row" onClick={() => onOpenTab(a.tab)}>
              <div className="ic bg-[var(--primary)]">
                <Icon name={a.icon} size={16} />
              </div>
              <div className="body">
                <div className="name">{a.label}</div>
              </div>
              <Icon name="chevron" size={16} className="chev" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
