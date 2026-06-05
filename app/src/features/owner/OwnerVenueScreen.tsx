import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Chip } from '../../shared/components/ui/Chip';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission, type Permission } from '../../shared/lib/permissions';
import { getOwnerVenue, entityId, type OwnerVenueDetail } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';
import { VenueOverviewTab } from './tabs/VenueOverviewTab';
import { InsightsTab } from './tabs/InsightsTab';
import { BookingsInboxTab } from './tabs/BookingsInboxTab';
import { ListingEditorTab } from './tabs/ListingEditorTab';
import { LocationEditorTab } from './tabs/LocationEditorTab';
import { HoursEditorTab } from './tabs/HoursEditorTab';
import { CourtsEditorTab } from './tabs/CourtsEditorTab';
import { FaqsEditorTab } from './tabs/FaqsEditorTab';
import { ReviewsInboxTab } from './tabs/ReviewsInboxTab';
import { PhotosTab } from './tabs/PhotosTab';

interface OwnerVenueScreenProps {
  venueId: string; // the slug (or _id) passed via navigation params
  initialTab?: string; // optional deep-link to a tab (e.g. 'bookings', 'insights')
  onNavigate: Navigate;
  onBack: () => void;
}

type TabId = 'overview' | 'insights' | 'bookings' | 'listing' | 'location' | 'hours' | 'courts' | 'faqs' | 'reviews' | 'photos';

// `perm` gates a tab behind a permission; tabs without one are always shown.
const TABS: { id: TabId; label: string; icon: string; perm?: Permission }[] = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'insights', label: 'Insights', icon: 'bar_chart', perm: 'owner.analytics.view' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar', perm: 'owner.bookings.manage' },
  { id: 'listing', label: 'Listing', icon: 'storefront' },
  { id: 'location', label: 'Location', icon: 'location' },
  { id: 'hours', label: 'Hours', icon: 'clock' },
  { id: 'courts', label: 'Courts', icon: 'paddle' },
  { id: 'faqs', label: 'FAQs', icon: 'help' },
  { id: 'reviews', label: 'Reviews', icon: 'star' },
  { id: 'photos', label: 'Photos', icon: 'camera' },
];

const TAB_TITLE: Record<TabId, string> = {
  overview: 'Overview',
  insights: 'Insights',
  bookings: 'Bookings',
  listing: 'Listing',
  location: 'Location',
  hours: 'Hours',
  courts: 'Courts',
  faqs: 'FAQs',
  reviews: 'Reviews',
  photos: 'Photos',
};

export function OwnerVenueScreen({ venueId: slug, initialTab, onNavigate, onBack }: OwnerVenueScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [venue, setVenue] = useState<OwnerVenueDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const startTab = TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : 'overview';
  const [tab, setTab] = useState<TabId>(startTab);

  useEffect(() => {
    let cancelled = false;
    getOwnerVenue(slug)
      .then((v) => {
        if (cancelled) return;
        setVenue(v);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const retry = () => {
    setStatus('loading');
    getOwnerVenue(slug)
      .then((v) => {
        setVenue(v);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  const reload = useCallback(() => {
    getOwnerVenue(slug).then(setVenue).catch(() => {});
  }, [slug]);

  const back = () => (tab === 'overview' ? onBack() : setTab('overview'));

  if (status === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom px-5">
        <ScreenHeader onBack={onBack} eyebrow="Owner" title="Venue" />
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  if (status === 'error' || !venue) {
    return (
      <div className="scroll safe-top safe-bottom">
        <ScreenHeader onBack={onBack} eyebrow="Owner" title="Venue" />
        <ErrorState title="Couldn't load this venue" message="We couldn't reach the venue. Tap to retry." onRetry={retry} />
      </div>
    );
  }

  // Ownership guard — you can only manage venues you own.
  const ownerId = String(venue.ownerUserId ?? '');
  if (ownerId && currentUser && ownerId !== currentUser.id) {
    return (
      <div className="scroll safe-top safe-bottom">
        <ScreenHeader onBack={onBack} eyebrow="Owner" title="Not your venue" />
        <EmptyState icon="lock" title="Not one of your venues" description="You can only manage venues you own." action={{ label: 'Back to your venues', onPress: onBack }} />
      </div>
    );
  }

  const vid = entityId(venue);
  const state = venue.state || 'unclaimed';

  return (
    <div className="scroll safe-top safe-bottom">
      <ScreenHeader
        onBack={back}
        eyebrow={`Owner · ${state}`}
        title={venue.displayName || 'Venue'}
        subtitle={tab === 'overview' ? undefined : TAB_TITLE[tab]}
        action={
          <button
            type="button"
            onClick={() => onNavigate('court-details', { id: venue.slug || vid })}
            aria-label="Preview public listing"
            className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--ink-2)]"
          >
            <Icon name="forward" size={16} />
          </button>
        }
      />

      <div className="scroll-x flex gap-2 px-5 pb-2">
        {TABS.filter((t) => !t.perm || userHasPermission(currentUser, t.perm)).map((t) => (
          <Chip key={t.id} selected={tab === t.id} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={13} /> {t.label}
          </Chip>
        ))}
      </div>

      <div className="px-5 pt-4">
        {tab === 'overview' && <VenueOverviewTab venue={venue} venueId={vid} onOpenTab={(t) => setTab(t as TabId)} />}
        {tab === 'insights' && <InsightsTab venueId={vid} />}
        {tab === 'bookings' && <BookingsInboxTab venueId={vid} />}
        {tab === 'listing' && <ListingEditorTab venue={venue} venueId={vid} reload={reload} />}
        {tab === 'location' && <LocationEditorTab venue={venue} venueId={vid} reload={reload} />}
        {tab === 'hours' && <HoursEditorTab venueId={vid} />}
        {tab === 'courts' && <CourtsEditorTab venueId={vid} reload={reload} />}
        {tab === 'faqs' && <FaqsEditorTab venueId={vid} />}
        {tab === 'reviews' && <ReviewsInboxTab venueId={vid} />}
        {tab === 'photos' && <PhotosTab venue={venue} venueId={vid} reload={reload} />}
      </div>
    </div>
  );
}
