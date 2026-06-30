import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { OwnerSection } from '../components/OwnerSection';
import {
  getSuggestedPricing, applySuggestedPricingOverrides,
  type PricingSuggestion,
} from '../../../shared/lib/api';
import { money } from '../../bookings/bookingDisplay';

interface PricingSuggestionsCardProps {
  venueId: string;
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function to12h(hour: number): string {
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${ampm}`;
}

function confClass(c: string): string {
  switch (c) {
    case 'high': return 'bg-[var(--lime)] text-[var(--ink)]';
    case 'medium': return 'bg-[var(--primary-soft)] text-[var(--primary-deep)]';
    default: return 'bg-[var(--surface-3)] text-[var(--muted)]';
  }
}

export function PricingSuggestionsCard({ venueId }: PricingSuggestionsCardProps) {
  const [suggestions, setSuggestions] = useState<PricingSuggestion[]>([]);
  const [summary, setSummary] = useState<{ total: number; highDemand: number; lowDemand: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getSuggestedPricing(venueId)
      .then((r) => {
        if (alive) { setSuggestions(r.suggestions); setSummary(r.summary); }
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load suggestions.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [venueId, expanded]);

  // Reset selection when suggestions change.
  useEffect(() => { setSelected(new Set()); setApplied(false); }, [suggestions]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllHigh = () => {
    setSelected(new Set(suggestions.filter((s) => s.confidence === 'high').map((_, i) => String(i))));
  };

  const handleApply = async () => {
    if (selected.size === 0) return;
    setApplying(true);
    setError(null);
    try {
      const items = [...selected].map((i) => {
        const s = suggestions[Number(i)];
        return { dow: s.dow, hour: s.hour, price: s.suggestedPrice };
      });
      await applySuggestedPricingOverrides(venueId, items);
      setApplied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply suggestions.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <OwnerSection title="Suggested pricing" icon="bolt" description="Demand-based price recommendations from your booking data">
      {/* Collapsed: summary + expand button */}
      {!expanded && !loading && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-2xl bg-[var(--lime)]/10 border border-[var(--lime)]/30 p-4 text-left transition-transform active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-9 h-9 rounded-full bg-[var(--lime)] flex items-center justify-center text-[var(--ink)] text-[16px]">⚡</span>
            <div className="min-w-0 flex-1">
              <div className="font-heading font-bold text-[14px] text-[var(--ink)]">Analyze demand &amp; get price suggestions</div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5">
                See which hours are underpriced based on actual booking patterns.
              </div>
            </div>
            <Icon name="chevron" size={16} className="text-[var(--muted)]" />
          </div>
        </button>
      )}

      {/* Expanded: full suggestions list */}
      {expanded && (
        <div>
          {/* Header with collapse */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[12px] font-bold text-[var(--primary)] flex items-center gap-1"
            >
              <Icon name="chevron" size={14} className="rotate-180" /> Collapse
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] rounded-xl bg-[var(--surface-2)] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-[13px] text-[var(--coral)] font-semibold py-2">{error}</div>
          ) : suggestions.length === 0 ? (
            <div className="rounded-xl bg-[var(--surface-2)] p-4 text-center">
              <div className="text-[13px] font-semibold text-[var(--muted)]">
                Not enough booking data yet to generate suggestions.
              </div>
              <div className="text-[12px] text-[var(--muted)] mt-1">
                Suggestions appear once there are 2+ weeks of confirmed booking data with clear demand patterns.
              </div>
            </div>
          ) : (
            <>
              {/* Summary + actions */}
              {summary && (
                <div className="flex items-center gap-2 mb-3 text-[11px] font-semibold">
                  <span className="text-[var(--muted)]">{summary.total} suggestions</span>
                  {summary.highDemand > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--coral)]/15 text-[var(--coral)]">
                      {summary.highDemand} ↑ raise
                    </span>
                  )}
                  {summary.lowDemand > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--blue)]/15 text-[var(--blue)]">
                      {summary.lowDemand} ↓ lower
                    </span>
                  )}
                  <div className="flex-1" />
                  <button type="button" onClick={selectAllHigh} className="text-[var(--primary)]">
                    Select all high-confidence
                  </button>
                </div>
              )}

              {/* Suggestion cards */}
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                {suggestions.map((s, i) => {
                  const key = String(i);
                  const isSel = selected.has(key);
                  const adjustUp = s.adjustmentPct > 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(key)}
                      className={`w-full text-left rounded-xl border-[1.5px] p-3 transition-colors ${
                        isSel
                          ? 'border-[var(--lime)] bg-[var(--lime)]/5'
                          : 'border-[var(--hairline)] bg-[var(--surface)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-[14px] text-[var(--ink)]">
                              {DOW_SHORT[s.dow]} {to12h(s.hour)}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${confClass(s.confidence)}`}>
                              {s.confidence}
                            </span>
                          </div>
                          <div className="text-[12px] text-[var(--muted)] mt-0.5">
                            {s.occupancyPct}% occupancy · {s.bookings} booked
                            {s.waitlistCount > 0 && ` · ${s.waitlistCount} waitlisted`}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[12px] text-[var(--muted)] line-through">{money(s.currentPrice)}</div>
                          <div className={`font-heading font-bold text-[16px] ${adjustUp ? 'text-[var(--coral)]' : 'text-[var(--blue)]'}`}>
                            {money(s.suggestedPrice)}
                          </div>
                          <div className={`text-[11px] font-bold ${adjustUp ? 'text-[var(--coral)]' : 'text-[var(--blue)]'}`}>
                            {adjustUp ? '+' : ''}{s.adjustmentPct}%
                          </div>
                        </div>
                        {isSel && (
                          <div className="shrink-0 w-5 h-5 rounded-full bg-[var(--lime)] flex items-center justify-center">
                            <Icon name="check" size={12} />
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] mt-1">{s.rationale}</div>
                    </button>
                  );
                })}
              </div>

              {/* Apply button */}
              <div className="mt-3">
                {applied ? (
                  <div className="rounded-xl bg-[var(--lime)]/15 text-[var(--lime-ink)] text-[13px] font-semibold p-3 text-center">
                    <Icon name="check" size={14} className="inline mr-1" />
                    {selected.size} pricing override{selected.size !== 1 ? 's' : ''} created for the next 4 weeks.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={selected.size === 0 || applying}
                    className="w-full h-11 rounded-xl bg-[var(--lime)] text-[var(--ink)] font-heading font-bold text-[14px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {applying
                      ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Applying…</>
                      : <><Icon name="bolt" size={16} /> Apply {selected.size} selected suggestion{selected.size !== 1 ? 's' : ''}</>}
                  </button>
                )}
                {error && <div className="text-[12px] text-[var(--coral)] font-semibold mt-2 text-center">{error}</div>}
              </div>
            </>
          )}
        </div>
      )}
    </OwnerSection>
  );
}
