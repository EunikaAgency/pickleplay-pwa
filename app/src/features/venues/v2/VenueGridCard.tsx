import type { CSSProperties } from 'react';
import type { ApiVenue } from '../../../shared/lib/api';
import { venueImage, locationLine } from '../../../shared/lib/venueDisplay';
import { venueRates, venueTypeBadge, cardAmenities } from './nearbyDisplay';

const CARD_GRADIENT = 'linear-gradient(135deg,#E1E8FF,#E9EDFF)';

// Always returns a `backgroundImage` (the photo, else a gradient). Must NOT be
// mixed with the `background` shorthand in the same style object: React sets
// `style.background = ''` for an undefined shorthand, which wipes backgroundImage.
function photoStyle(img: string | null): CSSProperties {
  return {
    backgroundImage: img ? `url(${img})` : CARD_GRADIENT,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

/**
 * A venue in the Nearby grid: photo with type / booking-policy / open-slot
 * badges, then name + location, member-vs-guest rates, rating, amenity chips
 * and the "View Courts" action. Every badge and price row hides itself when the
 * venue carries no data for it.
 */
export function VenueGridCard({ v, distance, slots, onOpen }: {
  v: ApiVenue;
  /** Formatted distance from the user ("1.8 km"), or null when unlocated. */
  distance: string | null;
  /** Open clock-hours on the chosen date, or null when availability isn't loaded. */
  slots: number | null;
  onOpen: () => void;
}) {
  const type = venueTypeBadge(v);
  const rates = venueRates(v);
  const amenities = cardAmenities(v);
  // The venue's booking policy is what decides whether a tap ends in a
  // confirmed court or a request the owner still has to approve.
  const instant = !v.requireBookingApproval;
  const place = [locationLine(v), distance].filter(Boolean).join(' · ');
  // Most seeded venues carry no photo. A bare gradient reads as a broken image
  // at this card size, so fall back to a court mark instead of empty space.
  const photo = venueImage(v);

  return (
    <article className="nv-card">
      <button type="button" className="nv-photo" onClick={onOpen} aria-label={`View courts at ${v.displayName}`}>
        <span className="nv-photo-img" style={photoStyle(photo)} aria-hidden="true" />
        {!photo && (
          <span className="nv-photo-fallback" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="4" x2="12" y2="20" /><circle cx="12" cy="12" r="2.6" /></svg>
            <span className="nv-photo-fallback-text">No photo yet</span>
          </span>
        )}
        {type && <span className={`nv-tag nv-tag-${type.tone}`}>{type.label}</span>}
        <span className={`nv-book ${instant ? 'instant' : 'request'}`}>
          {instant && (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          )}
          {instant ? 'Instant book' : 'Request to book'}
        </span>
        {slots != null && slots > 0 && (
          <span className="nv-slots">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            {slots} slot{slots === 1 ? '' : 's'} open
          </span>
        )}
      </button>

      <div className="nv-body">
        <div className="nv-head">
          <div className="nv-head-main">
            <h3 className="nv-name">{v.displayName}</h3>
            {place && (
              <div className="nv-loc">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {place}
              </div>
            )}
          </div>

          <div className="nv-price">
            {rates.member && (
              <div className="nv-rate">
                <span className="nv-rate-tag member">Member</span>
                <span className="nv-rate-val">{rates.member}</span>
              </div>
            )}
            {rates.guest && (
              <div className="nv-rate">
                {rates.member && <span className="nv-rate-tag guest">Guest</span>}
                <span className="nv-rate-val">{rates.guest}</span>
              </div>
            )}
            {!rates.guest && rates.label && (
              <div className="nv-rate"><span className="nv-rate-val soft">{rates.label}</span></div>
            )}
            {v.googleRating != null && (
              <div className="nv-rating">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" strokeWidth="1" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                <span className="nv-rating-num">{v.googleRating.toFixed(1)}</span>
                {v.googleReviewCount ? <span className="nv-rating-count">({v.googleReviewCount})</span> : null}
              </div>
            )}
          </div>
        </div>

        {amenities.length > 0 && (
          <div className="nv-amenities">
            {amenities.map((a) => <span key={a} className="nv-amenity">{a}</span>)}
          </div>
        )}

        <button type="button" className="nv-cta" onClick={onOpen}>
          View Courts
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </button>
      </div>
    </article>
  );
}
