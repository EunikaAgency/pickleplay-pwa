import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { useDragScroll } from '../../shared/hooks/useDragScroll';
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
import { MembersTab } from './tabs/MembersTab';
import { ListingEditorTab } from './tabs/ListingEditorTab';
import { LocationEditorTab } from './tabs/LocationEditorTab';
import { ClosuresEditorTab } from './tabs/ClosuresEditorTab';
import { CourtsEditorTab } from './tabs/CourtsEditorTab';
import { SlotPricingTab } from './tabs/SlotPricingTab';
import { FaqsEditorTab } from './tabs/FaqsEditorTab';
import { PhotosTab } from './tabs/PhotosTab';
import { StaffEditorTab } from './tabs/StaffEditorTab';

interface OwnerVenueScreenProps {
  venueId: string; // the slug (or _id) passed via navigation params
  initialTab?: string; // optional deep-link to a tab (e.g. 'bookings', 'insights')
  onNavigate: Navigate;
  onBack: () => void;
}

type TabId = 'overview' | 'insights' | 'bookings' | 'members' | 'listing' | 'location' | 'courts' | 'pricing' | 'closures' | 'faqs' | 'photos' | 'staff';

// `perm` gates a tab behind a permission; tabs without one are always shown.
// Structural-edit tabs are hidden for front-desk staff (they can only operate,
// not change the venue listing/courts/pricing/faqs/photos/staff).
const STRUCTURAL_TABS: TabId[] = ['listing', 'location', 'courts', 'pricing', 'closures', 'faqs', 'photos', 'staff'];

const TABS: { id: TabId; label: string; icon: string; perm?: Permission }[] = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'insights', label: 'Insights', icon: 'bar_chart', perm: 'owner.analytics.view' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar', perm: 'owner.bookings.manage' },
  { id: 'members', label: 'Membership', icon: 'group', perm: 'owner.bookings.manage' },
  { id: 'listing', label: 'Listing', icon: 'storefront' },
  { id: 'location', label: 'Location', icon: 'location' },
  { id: 'courts', label: 'Courts', icon: 'sports_tennis' },
  { id: 'pricing', label: 'Slot pricing', icon: 'bolt', perm: 'owner.bookings.manage' },
  { id: 'closures', label: 'Closures', icon: 'calendar' },
  { id: 'faqs', label: 'FAQs', icon: 'help' },
  // Reviews hidden for now
  { id: 'photos', label: 'Photos', icon: 'camera' },
  { id: 'staff', label: 'Staff', icon: 'group', perm: 'owner.staff.manage' },
];

const TAB_TITLE: Record<TabId, string> = {
  overview: 'Overview',
  insights: 'Insights',
  bookings: 'Bookings',
  members: 'Membership',
  listing: 'Listing',
  location: 'Location',
  courts: 'Courts',
  pricing: 'Slot pricing',
  closures: 'Closures',
  faqs: 'FAQs',
  photos: 'Photos',
  staff: 'Staff',
};

export function OwnerVenueScreen({ venueId: slug, initialTab, onNavigate, onBack }: OwnerVenueScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [venue, setVenue] = useState<OwnerVenueDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  // The active tab is derived from the URL (`?tab=`), not local state, so a page
  // reload (or a shared link) lands on the same tab instead of snapping back to
  // Overview. Switching tabs `replace`s the URL (no history spam / back-button
  // trap) — the screen is keyed by venue id, so this re-renders without remounting.
  const tab: TabId = TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : 'overview';
  const goTab = useCallback(
    (next: TabId) => onNavigate('owner-venue', { id: slug, tab: next === 'overview' ? undefined : next }, { replace: true }),
    [onNavigate, slug],
  );
  // The tab strip overflows on narrow widths — make it drag/wheel-scrollable.
  const tabsRef = useRef<HTMLDivElement>(null);
  useDragScroll(tabsRef);

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

  // Back always leaves the venue screen (returns to wherever the owner came
  // from). Tabs are switched by tapping the pills, so back must NOT detour
  // through Overview first — that forced an annoying "double back" to exit.
  const back = () => onBack();

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
  // Staff see a role badge — "Manager" or "Front desk" — so it's clear what they
  // can do here (servers won't let them make structural edits, and the tab strip
  // hides those tabs for front-desk).
  const viewerRole = venue.viewerStaffRole;
  const staffBadge = viewerRole === 'front_desk' ? 'Front desk' : viewerRole === 'manager' ? 'Manager' : null;

  return (
    <div className="scroll safe-top safe-bottom">
      <ScreenHeader
        onBack={back}
        eyebrow={`Owner · ${state}${staffBadge ? ` · ${staffBadge}` : ''}`}
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

      <div ref={tabsRef} className="scroll-x flex gap-2 px-5 pb-2 cursor-grab active:cursor-grabbing select-none">
        {TABS
          .filter((t) => !t.perm || userHasPermission(currentUser, t.perm))
          // Front-desk staff see operational tabs only — structural edits are
          // hidden (and 403'd server-side if they reach them anyway).
          .filter((t) => venue?.viewerStaffRole !== 'front_desk' || !STRUCTURAL_TABS.includes(t.id))
          .map((t) => (
          <Chip key={t.id} className="chip-tab" selected={tab === t.id} onClick={() => goTab(t.id)}>
            <Icon name={t.icon} size={13} /> {t.label}
          </Chip>
        ))}
      </div>

      <div className="px-5 pt-4">
        {tab === 'overview' && <VenueOverviewTab venue={venue} venueId={vid} onOpenTab={(t) => goTab(t as TabId)} />}
        {tab === 'insights' && <InsightsTab venueId={vid} />}
        {tab === 'bookings' && <BookingsInboxTab venueId={vid} onNavigate={onNavigate} />}
        {tab === 'members' && <MembersTab venueId={vid} venue={venue} onNavigate={onNavigate} />}
        {tab === 'listing' && <ListingEditorTab venue={venue} venueId={vid} reload={reload} onDeleted={() => onNavigate('owner-venues', undefined, { replace: true })} />}
        {tab === 'location' && <LocationEditorTab venue={venue} venueId={vid} reload={reload} />}
        {tab === 'courts' && <CourtsEditorTab venueId={vid} reload={reload} />}
        {tab === 'pricing' && <SlotPricingTab venueId={vid} />}
        {tab === 'closures' && <ClosuresEditorTab venueId={vid} />}
        {tab === 'faqs' && <FaqsEditorTab venueId={vid} />}
        {tab === 'photos' && <PhotosTab venue={venue} venueId={vid} reload={reload} />}
        {tab === 'staff' && <StaffEditorTab venueId={vid} />}
      </div>
    </div>
  );
}
