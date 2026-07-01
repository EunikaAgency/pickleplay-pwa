import { Icon } from '../../../shared/components/ui/Icon';

type StatTone = 'primary' | 'lime' | 'coral' | 'neutral';

interface OwnerStatProps {
  label: string;
  value: string | number;
  icon: string;
  tone?: StatTone;
  /** When provided, the tile becomes a button that drills into a detail screen. */
  onClick?: () => void;
}

const TONE_CLASS: Record<StatTone, string> = {
  primary: 'bg-[var(--primary-tint)] text-[var(--primary)]',
  lime: 'bg-[var(--lime-soft)] text-[var(--lime-ink)]',
  coral: 'bg-[var(--coral-soft)] text-[var(--coral)]',
  neutral: 'bg-[var(--surface-2)] text-[var(--ink-2)]',
};

// A small stat tile (the app has no shared StatCard; the web console's lives in
// web/src/shared/components/dashboard).
export function OwnerStat({ label, value, icon, tone = 'primary', onClick }: OwnerStatProps) {
  const body = (
    <>
      <span className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${TONE_CLASS[tone]}`}>
        <Icon name={icon} size={18} />
      </span>
      <div>
        <div className="font-heading font-bold text-2xl leading-none text-[var(--ink)] tabular-nums">{value}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-1">{label}</div>
      </div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2.5 text-left w-full active:scale-[0.97] transition-transform">
        {body}
      </button>
    );
  }
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2.5">{body}</div>;
}
