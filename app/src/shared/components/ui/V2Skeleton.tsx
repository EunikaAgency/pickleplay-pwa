import type { CSSProperties } from 'react';

/**
 * Skeleton placeholders for the v2.1 player screens — shimmer blocks shaped like
 * each surface's real cards/rows, so a loading state matches the final layout
 * instead of showing a "Loading…" string.
 *
 * Each variant reuses the screen's REAL card wrapper class (`.game-card`,
 * `.club-card`, `.court-card`, `.tt-card`, `.match-item`, …) so the placeholder
 * inherits the exact surface/radius/shadow/size, and fills the inner content
 * with `.v2sk` blocks (fill + pulse + reduced-motion live in v2.css). Must render
 * inside the `.pb-v2` scope — every `V2Shell` screen is — so the tokens resolve.
 */

type Variant =
  | 'home-featured'    // HomeScreenV2 — the "Featured Today" hero card
  | 'home-discover'    // HomeScreenV2 — horizontal "Discover" rail of game cards
  | 'game-list'        // GamesScreenV2 — vertical game cards (thumb left + body)
  | 'club-list'        // ClubsScreenV2 — vertical club rows (icon + lines)
  | 'court-list'       // NearbyScreenV2 — a featured court card + court rows
  | 'tournament-list'  // TournamentsScreenV2 — vertical tournament cards
  | 'match-list';      // ProfileScreenV2 — recent-games rows

const sk = 'v2sk';
const line = (width: string, height = 12): CSSProperties => ({ width, height, borderRadius: 6 });
const pill = (width: number, height = 18): CSSProperties => ({ width, height, borderRadius: 999, flexShrink: 0 });
const bodyCol: CSSProperties = { flex: 1, minWidth: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'center' };

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

/** A vertical game card (Games tab): full-width row, square-ish thumb + body. */
function GameRow() {
  return (
    <div className="game-card" aria-hidden="true">
      <div className={sk} style={{ width: 112, flexShrink: 0 }} />
      <div style={bodyCol}>
        <div className={sk} style={line('66%', 14)} />
        <div className={sk} style={line('52%', 11)} />
        <div className={sk} style={line('40%', 11)} />
      </div>
    </div>
  );
}

/** The Home "Featured Today" hero card: tall media banner + content + CTA. */
function FeaturedCard() {
  return (
    <div className="featured" aria-hidden="true">
      <div className={sk} style={{ height: 180, borderRadius: 0 }} />
      <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className={sk} style={line('70%', 12)} />
        <div className={sk} style={line('40%', 12)} />
        <div className={sk} style={{ width: 132, height: 40, borderRadius: 999 }} />
      </div>
    </div>
  );
}

/** A horizontal "Discover" card (Home tab): fixed width, thumb on top + body. */
function DiscoverCard() {
  return (
    <div className="game-card" aria-hidden="true" style={{ minWidth: 210 }}>
      <div className={sk} style={{ height: 120, borderRadius: 0 }} />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className={sk} style={line('75%', 14)} />
        <div className={sk} style={line('50%', 11)} />
        <div className={sk} style={{ width: '100%', height: 6, borderRadius: 999, marginTop: 4 }} />
      </div>
    </div>
  );
}

/** A club row (Clubs tab): rounded icon + name + two lines. */
function ClubRow() {
  return (
    <div className="club-card" aria-hidden="true">
      <div className={sk} style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className={sk} style={line('50%', 14)} />
        <div className={sk} style={line('35%', 10)} />
        <div className={sk} style={line('28%', 10)} />
      </div>
    </div>
  );
}

/** A court row (Nearby tab): thumb left + body with name, meta, attribute pills. */
function CourtRow() {
  return (
    <div className="court-card" aria-hidden="true">
      <div className="card-inner">
        <div className={sk} style={{ width: 110, minHeight: 110, flexShrink: 0, borderRadius: 0 }} />
        <div style={bodyCol}>
          <div className={sk} style={line('60%', 14)} />
          <div className={sk} style={line('75%', 11)} />
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <div className={sk} style={pill(64)} />
            <div className={sk} style={pill(48)} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A tournament card (Tournament tab): banner thumb left + body. */
function TournamentRow() {
  return (
    <div className="tt-card" aria-hidden="true">
      <div className={sk} style={{ width: 116, flexShrink: 0, borderRadius: 0 }} />
      <div style={bodyCol}>
        <div className={sk} style={line('62%', 14)} />
        <div className={sk} style={line('48%', 11)} />
        <div className={sk} style={line('38%', 11)} />
      </div>
    </div>
  );
}

/** A recent-games row (Profile tab): date badge + two lines + role tag. */
function MatchRow() {
  return (
    <div className="match-item" aria-hidden="true">
      <div className={sk} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className={sk} style={line('55%', 13)} />
        <div className={sk} style={line('35%', 10)} />
      </div>
      <div className={sk} style={pill(54, 20)} />
    </div>
  );
}

export function V2Skeleton({ variant, count = 4 }: { variant: Variant; count?: number }) {
  if (variant === 'home-featured') {
    return <div aria-busy="true" aria-live="polite"><FeaturedCard /></div>;
  }

  if (variant === 'home-discover') {
    return (
      <div className="scroll-row" aria-busy="true" aria-live="polite">
        {range(count).map((i) => <DiscoverCard key={i} />)}
      </div>
    );
  }

  if (variant === 'court-list') {
    // A featured court card (thumb on top + body) followed by court rows.
    return (
      <div aria-busy="true" aria-live="polite">
        <div className="featured-card" aria-hidden="true">
          <div className={sk} style={{ height: 160, borderRadius: 0 }} />
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className={sk} style={line('55%', 15)} />
            <div className={sk} style={line('70%', 11)} />
          </div>
        </div>
        <div style={{ height: 12 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {range(Math.max(1, count - 1)).map((i) => <CourtRow key={i} />)}
        </div>
      </div>
    );
  }

  const Row =
    variant === 'game-list' ? GameRow :
    variant === 'club-list' ? ClubRow :
    variant === 'tournament-list' ? TournamentRow :
    MatchRow;

  return (
    <div aria-busy="true" aria-live="polite">
      {range(count).map((i) => <Row key={i} />)}
    </div>
  );
}
