import { useEffect, useState } from 'react';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { Chip } from '../../../shared/components/ui/Chip';
import { OwnerStat } from '../components/OwnerStat';
import { OwnerSection } from '../components/OwnerSection';
import { PricingSuggestionsCard } from './PricingSuggestionsCard';
import { getVenueDemand, type VenueDemandReport } from '../../../shared/lib/api';

interface DemandTabProps {
  venueId: string;
}

const DAY_PRESETS = [30, 90, 365] as const;

// ── Signal metadata ───────────────────────────────────────────────

interface SignalMeta { label: string; icon: string; description: string }

const SIGNAL_INFO: Record<string, SignalMeta> = {
  search: {
    label: 'Searches',
    icon: 'search',
    description: 'Players who searched for your venue by name or area',
  },
  venue_view: {
    label: 'Views',
    icon: 'visibility',
    description: 'Players who opened your venue page to check pricing, courts, or availability',
  },
  booking_attempt: {
    label: 'Attempts',
    icon: 'play_arrow',
    description: 'Players who hit "Book" — they picked a court, date, and time and tried to reserve it',
  },
  booking_completed: {
    label: 'Completed',
    icon: 'check_circle',
    description: 'Bookings that were successfully created (paid, pay-at-venue, or awaiting your approval)',
  },
  booking_cancelled: {
    label: 'Cancelled',
    icon: 'cancel',
    description: 'Bookings that were cancelled by the player or declined by you',
  },
  empty_slot: {
    label: 'Full slots',
    icon: 'block',
    description: 'Times a player wanted to book but the slot was already taken — unmet demand',
  },
  checkout_started: {
    label: 'Checkouts',
    icon: 'shopping_cart',
    description: 'Players who reached the payment screen — they saw the price and were about to pay',
  },
  checkout_abandoned: {
    label: 'Abandoned',
    icon: 'undo',
    description: 'Players who left the payment screen without completing — maybe the price or timing didn\'t work',
  },
  booking_link_shared: {
    label: 'Links shared',
    icon: 'share',
    description: 'Times your booking link was copied or shared — word-of-mouth reach',
  },
};

const SIGNAL_ORDER = [
  'search', 'venue_view', 'booking_attempt', 'checkout_started',
  'checkout_abandoned', 'booking_completed', 'booking_cancelled',
  'empty_slot', 'booking_link_shared',
];

/** "72%" or "—" */
function pct(n: number | null): string {
  return n != null ? `${n}%` : '—';
}

export function DemandTab({ venueId }: DemandTabProps) {
  const [data, setData] = useState<VenueDemandReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [days, setDays] = useState<number>(30);
  const [retryCtr, setRetryCtr] = useState(0);

  useEffect(() => {
    setStatus('loading');
    let alive = true;
    getVenueDemand(venueId, days)
      .then((r) => { if (alive) { setData(r); setStatus('ready'); } })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [venueId, days, retryCtr]);

  if (status === 'loading') return <LoadingSkeleton variant="card" count={4} />;
  if (status === 'error') return <ErrorState message="Couldn't load the demand report." onRetry={() => setRetryCtr((k) => k + 1)} />;
  if (!data) return null;

  const { totals, conversionPct, cancelRate, liveBookings, demandByHour, supply } = data;

  const maxByHour = Math.max(1, ...demandByHour);

  return (
    <div className="flex flex-col gap-5">
      {/* Day-range selector */}
      <div className="flex gap-2">
        {DAY_PRESETS.map((d) => (
          <Chip key={d} className="chip-tab" selected={days === d} onClick={() => setDays(d)}>
            {d}d
          </Chip>
        ))}
      </div>

      {/* HIDDEN-DESC: flip false→true to show the intro */}
      {false && (
        <p className="text-[13px] text-[var(--ink-2)] leading-relaxed">
          Every time a player searches for your venue, views your page, starts a
          booking, reaches checkout, or hits a full slot — we record it here. Think
          of this as your venue's <strong>demand heartbeat</strong>: it shows how much
          interest you're getting, where players drop off, and which hours are
          hottest. Use it to spot underpriced peak times, overpriced dead hours, or
          capacity you could add.
        </p>
      )}

      {/* ── Awareness signals ── */}
      <OwnerSection
        title="Discovery"
        icon="visibility"
        description="How players find you — the top of your demand funnel."
      >
        <div className="grid grid-cols-2 gap-3">
          {['search', 'venue_view', 'booking_link_shared'].map((key) => (
            <OwnerStat
              key={key}
              label={SIGNAL_INFO[key].label}
              value={String(totals[key] ?? 0)}
              icon={SIGNAL_INFO[key].icon}
            />
          ))}
        </div>
        {/* HIDDEN-DESC: flip false→true */}
        {false && (
          <p className="mt-2 text-[12px] text-[var(--ink-2)]">
            <strong>Searches</strong> — players typed your venue name or area into the search bar.
            <strong> Views</strong> — they opened your page.
            <strong> Links shared</strong> — your booking link was copied or sent to someone.
          </p>
        )}
      </OwnerSection>

      {/* ── Booking-intent signals ── */}
      <OwnerSection
        title="Booking intent"
        icon="shopping_cart"
        description="Players who tried to book — and what happened next."
      >
        <div className="grid grid-cols-2 gap-3">
          {['booking_attempt', 'checkout_started', 'checkout_abandoned', 'booking_completed'].map((key) => (
            <OwnerStat
              key={key}
              label={SIGNAL_INFO[key].label}
              value={String(totals[key] ?? 0)}
              icon={SIGNAL_INFO[key].icon}
            />
          ))}
        </div>
        {/* HIDDEN-DESC: flip false→true */}
        {false && (
          <p className="mt-2 text-[12px] text-[var(--ink-2)]">
            <strong>Attempts</strong> — they picked a court + time and tapped "Book."
            <strong> Checkouts</strong> — they reached the payment screen (saw the price).
            <strong> Abandoned</strong> — they left without paying.
            <strong> Completed</strong> — booking created successfully.
          </p>
        )}
      </OwnerSection>

      {/* ── Friction signals ── */}
      <OwnerSection
        title="Friction"
        icon="warning"
        description="Signals that something isn't working — cancellations and missed opportunities."
      >
        <div className="grid grid-cols-2 gap-3">
          {['booking_cancelled', 'empty_slot'].map((key) => (
            <OwnerStat
              key={key}
              label={SIGNAL_INFO[key].label}
              value={String(totals[key] ?? 0)}
              icon={SIGNAL_INFO[key].icon}
            />
          ))}
        </div>
        {/* HIDDEN-DESC: flip false→true */}
        {false && (
          <p className="mt-2 text-[12px] text-[var(--ink-2)]">
            <strong>Full slots</strong> — a player wanted a time that was already
            booked (unmet demand — you might need more courts or higher prices for
            those peak hours).
            <strong> Cancelled</strong> — bookings that fell through
            (player-cancelled or declined).
          </p>
        )}
      </OwnerSection>

      {/* ── Conversion & cancellation ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <OwnerStat label="Conversion rate" value={pct(conversionPct)} tone="lime" icon="trending_up" />
          {/* HIDDEN-DESC: flip false→true */}
          {false && (
            <p className="mt-1 text-[11px] text-[var(--ink-2)] px-1">
              Of the players who attempted to book, how many completed. Low? Check
              your pricing or approval flow.
            </p>
          )}
        </div>
        <div>
          <OwnerStat label="Cancellation rate" value={`${cancelRate}%`} tone="coral" icon="cancel" />
          {/* HIDDEN-DESC: flip false→true */}
          {false && (
            <p className="mt-1 text-[11px] text-[var(--ink-2)] px-1">
              Completed bookings that later got cancelled. High? Your pay window or
              cancellation policy may be too loose.
            </p>
          )}
        </div>
      </div>

      {/* ── Demand by hour ── */}
      <OwnerSection
        title="Demand by hour"
        icon="schedule"
        description="When players try to book. Each bar = how many booking attempts + full-slot hits happened during that hour. Tall bars = peak demand — raise prices. Short bars = dead hours — discount them or promote those slots."
      >
        {demandByHour.every((v) => v === 0) ? (
          <p className="text-[13px] text-[var(--ink-2)] py-4 text-center">No demand data yet — start getting bookings and this chart will fill in.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <div className="flex gap-[3px] items-end min-w-[672px] h-[72px]">
              {demandByHour.map((v, h) => {
                const heightPct = (v / maxByHour) * 100;
                const height = v === 0 ? 4 : 4 + (heightPct / 100) * 68;
                const opacity = v === 0 ? 0 : 0.15 + (v / maxByHour) * 0.85;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center justify-end min-w-0">
                    <div
                      className="w-full rounded-[3px] transition-[height] duration-300"
                      style={{
                        height: `${height}px`,
                        background: v === 0
                          ? 'var(--surface-2)'
                          : `color-mix(in srgb, var(--primary) ${Math.round(opacity * 100)}%, transparent)`,
                      }}
                      title={`${h}:00 – ${v} event${v === 1 ? '' : 's'}`}
                    />
                    {h % 3 === 0 && (
                      <span className="text-[10px] text-[var(--muted)] mt-1 leading-none">{h}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* HIDDEN-DESC: flip false→true */}
        {false && (
          <p className="mt-2 text-[12px] text-[var(--ink-2)]">
            <strong>How to read this:</strong> each bar is an hour of the day
            (scroll sideways to see all 24). Darker &amp; taller = more demand.
            Hover any bar for the exact count. Hours with zero demand show as thin
            grey lines.
          </p>
        )}
      </OwnerSection>

      {/* ── Supply ── */}
      <OwnerSection
        title="Supply & occupancy"
        icon="paddle"
        description="How much court time you have vs how much actually got booked. Think of it like a hotel: open = rooms you listed, booked = rooms sold, empty = rooms that sat vacant."
      >
        <div className="grid grid-cols-2 gap-3">
          <OwnerStat label="Open court‑hours" value={String(supply.openCourtHours)} icon="schedule" />
          <OwnerStat label="Booked court‑hours" value={String(supply.bookedCourtHours)} icon="check_circle" />
          <OwnerStat label="Empty court‑hours" value={String(supply.emptyCourtHours)} icon="block" />
          <OwnerStat label="Occupancy" value={`${supply.occupancyPct}%`} tone={supply.occupancyPct >= 50 ? 'lime' : 'coral'} icon="bar_chart" />
        </div>
        {/* HIDDEN-DESC: flip false→true */}
        {false && (
          <p className="mt-2 text-[12px] text-[var(--ink-2)]">
            <strong>Open court‑hours</strong> — total hours your courts were
            available (courts × open hours/day × days).
            <strong> Booked</strong> — hours actually reserved.
            <strong> Empty</strong> — hours that went unused.
            <strong> Occupancy</strong> — booked ÷ open. {supply.occupancyPct < 50
              ? "Below 50% — you're leaving money on the table. Try lowering prices for dead hours or promoting your venue more."
              : supply.occupancyPct >= 80
                ? "Above 80% — your courts are in high demand. Consider raising prices or adding capacity."
                : 'Decent utilisation, but there\'s room to grow.'}
          </p>
        )}
      </OwnerSection>

      {/* Inline pricing suggestions (already built) */}
      <PricingSuggestionsCard venueId={venueId} />
    </div>
  );
}
