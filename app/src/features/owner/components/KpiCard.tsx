import { Icon } from '../../../shared/components/ui/Icon';

type KpiTone = 'primary' | 'lime' | 'coral' | 'neutral' | 'blue' | 'star';

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  tone?: KpiTone;
  /** Signed percent change vs the previous period (omit to hide the trend row). */
  delta?: number | null;
  /** Text after the delta, e.g. "vs last month". */
  deltaSuffix?: string;
  /** Supporting line shown when there's no delta (e.g. "Scheduled ahead"). */
  sub?: string;
  /** For metrics where a decrease is good (cancellation/no-show): flips the colour. */
  invertDelta?: boolean;
  /** Extra classes on the tile — e.g. a grid span. */
  className?: string;
}

const TONE_CLASS: Record<KpiTone, string> = {
  primary: 'bg-[var(--primary-tint)] text-[var(--primary)]',
  lime: 'bg-[var(--lime-soft)] text-[var(--lime-ink)]',
  coral: 'bg-[var(--coral-soft)] text-[var(--coral)]',
  neutral: 'bg-[var(--surface-2)] text-[var(--ink-2)]',
  blue: 'bg-[#dde6ff] text-[#2952cc]',
  star: 'bg-[var(--star-soft)] text-[var(--star-ink)]',
};

// A modern analytics summary tile: small uppercase label, large value, and a
// coloured trend indicator (or a supporting line). The app's answer to the
// reference dashboard's KPI cards — white surface + brand tones, not the
// reference's dark cards.
export function KpiCard({ label, value, icon, tone = 'primary', delta, deltaSuffix, sub, invertDelta, className = '' }: KpiCardProps) {
  const hasDelta = delta != null && Number.isFinite(delta);
  const rising = (delta ?? 0) > 0;
  const flat = (delta ?? 0) === 0;
  const good = invertDelta ? !rising : rising;
  const deltaColor = flat ? 'text-[var(--muted)]' : good ? 'text-[#16794c]' : 'text-[var(--coral)]';
  const arrow = flat ? 'trending_flat' : rising ? 'arrow_upward' : 'arrow_downward';

  return (
    <div className={`rounded-2xl border border-[var(--field-border)] bg-[var(--surface)] shadow-sm p-3.5 sm:p-4 transition-shadow hover:shadow-md ${className}`}>
      <div className="flex items-start justify-between gap-2">
        {/* min-w-0 + break-words: a long single-word label (e.g. "ORGANISERS") would
            otherwise hold its min-content width and push the icon outside the tile. */}
        <span className="min-w-0 break-words text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] leading-tight">{label}</span>
        <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${TONE_CLASS[tone]}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="font-heading font-bold text-[26px] leading-none text-[var(--ink)] tabular-nums mt-2.5">{value}</div>
      {hasDelta ? (
        <div className="flex items-center gap-1 mt-2 min-w-0">
          <span className={`inline-flex items-center gap-0.5 text-[12px] font-bold ${deltaColor}`}>
            <Icon name={arrow} size={13} />
            {flat ? '0%' : `${rising ? '+' : ''}${delta}%`}
          </span>
          {deltaSuffix && <span className="text-[11px] text-[var(--muted)] truncate">{deltaSuffix}</span>}
        </div>
      ) : sub ? (
        <div className="text-[12px] text-[var(--muted)] mt-2 truncate">{sub}</div>
      ) : null}
    </div>
  );
}
