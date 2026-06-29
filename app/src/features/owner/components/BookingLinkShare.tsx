import { useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Toast } from '../../../shared/components/ui/Toast';
import { recordDemandEvent, type OwnerVenueDetail } from '../../../shared/lib/api';

/**
 * Build the venue's public booking link: the system slug, or the owner's custom
 * `bookingSlug` when set. Composed off `window.location.origin` (like the club
 * share link) so it points at whatever host the PWA is served from. The path
 * (`/venues/<slug>`) deep-links to the court page where players book.
 */
function bookingLinkFor(venue: Pick<OwnerVenueDetail, 'bookingSlug' | 'slug' | 'id'>): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const slug = (venue.bookingSlug && String(venue.bookingSlug)) || venue.slug || venue.id || '';
  return `${origin}/venues/${slug}`;
}

interface BookingLinkShareProps {
  venue: OwnerVenueDetail;
  /** Show a "copied" toast (Overview uses this; the listing editor has its own save status). */
  withToast?: boolean;
}

// The read-only booking link + Copy + Share controls. Shared by the venue
// Overview card and the Listing editor's "Booking link" block.
export function BookingLinkShare({ venue, withToast = false }: BookingLinkShareProps) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(false);
  const link = bookingLinkFor(venue);

  const signalShare = () => {
    recordDemandEvent({ type: 'booking_link_shared', venueId: venue.id });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (withToast) {
        setToast(true);
        setTimeout(() => setToast(false), 2000);
      }
      signalShare();
    } catch {
      /* clipboard unavailable */
    }
  };

  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: venue.displayName || 'Book a court',
          text: `Book a court at ${venue.displayName || 'our venue'} on PickleBallers`,
          url: link,
        });
        signalShare();
      } catch {
        /* user dismissed the share sheet — no-op */
      }
      return;
    }
    copy();
  };

  return (
    <>
      <div className="flex gap-2">
        <div className="control flex items-center min-w-0 flex-1">
          <span className="truncate text-[var(--ink)]">{link}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="px-4 rounded-2xl bg-[var(--surface-2)] text-[var(--primary)] font-bold text-[13px] shrink-0 flex items-center gap-1.5"
        >
          {copied ? <><Icon name="check" size={14} /> Copied</> : 'Copy'}
        </button>
        <button
          type="button"
          onClick={share}
          aria-label="Share booking link"
          className="px-3 rounded-2xl bg-[var(--surface-2)] text-[var(--primary)] shrink-0 flex items-center justify-center"
        >
          <Icon name="share" size={16} />
        </button>
      </div>
      {withToast && <Toast message="Booking link copied" show={toast} />}
    </>
  );
}
