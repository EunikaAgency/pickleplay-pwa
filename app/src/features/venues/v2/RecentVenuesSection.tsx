import type { RecentVenue } from './nearbyDisplay';

/**
 * The "venues you've played at recently" rail — a shortcut straight back to the
 * courts a player already knows, with the rate they'd pay next time. Renders
 * nothing when they haven't played anywhere yet (including every guest).
 */
export function RecentVenuesSection({ items, onOpen }: {
  items: RecentVenue[];
  onOpen: (target: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="nv-section">
      <h2 className="nv-section-title">Venues you've played at recently</h2>
      <div className="nv-recent-grid">
        {items.map((r) => (
          <div key={r.venueId} className="nv-recent">
            <span
              className="nv-recent-img"
              style={{
                backgroundImage: r.image ? `url(${r.image})` : 'linear-gradient(135deg,#E1E8FF,#E9EDFF)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              aria-hidden="true"
            />
            <div className="nv-recent-body">
              <div className="nv-recent-name">{r.name}</div>
              <div className="nv-recent-meta">Played {r.playCount}× · {r.lastPlayed}</div>
              {r.rate && (
                <div className="nv-recent-rate">{r.rate}{r.rateIsMember ? ' member' : ''}</div>
              )}
            </div>
            <button
              type="button"
              className="nv-recent-cta"
              onClick={() => onOpen(r.target)}
              aria-label={`View ${r.name}`}
            >
              View
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
