import { Icon } from '../../shared/components/ui/Icon';

type StatTone = 'primary' | 'lime' | 'coral' | 'neutral';

interface OwnerStatProps {
  label: string;
  value: string | number;
  icon: string;
  tone?: StatTone;
}

const TONE_CLASS: Record<StatTone, string> = {
  primary: 'bg-[var(--primary-tint)] text-[var(--primary)]',
  lime: 'bg-[var(--lime-soft)] text-[var(--lime-ink)]',
  coral: 'bg-[var(--coral-soft)] text-[var(--coral)]',
  neutral: 'bg-[var(--surface-2)] text-[var(--ink-2)]',
};

// A small stat tile (the app has no shared StatCard; the web console's lives in
// web/src/shared/components/dashboard).
export function OwnerStat({ label, value, icon, tone = 'primary' }: OwnerStatProps) {
  return (
    <div className="card p-3.5 flex flex-col gap-2.5">
      <span className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${TONE_CLASS[tone]}`}>
        <Icon name={icon} size={18} />
      </span>
      <div>
        <div className="font-heading font-semibold text-[22px] leading-none text-[var(--ink)] tabular-nums">{value}</div>
        <div className="t-eyebrow mt-1">{label}</div>
      </div>
    </div>
  );
}
