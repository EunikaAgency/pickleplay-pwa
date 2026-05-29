import { Icon } from '../ui/Icon';
import { skillTiers, type SkillTier } from '../../lib/skillTiers';

interface FormTierPickerProps {
  label?: string;
  value: SkillTier['id'] | null;
  onChange: (value: SkillTier['id']) => void;
  error?: string;
}

export function FormTierPicker({ label, value, onChange, error }: FormTierPickerProps) {
  return (
    <div className="field p-0!">
      {label && <div className="lbl">{label}</div>}
      <div className="flex flex-col gap-2.5">
        {skillTiers.map((tier) => {
          const isActive = value === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => onChange(tier.id)}
              aria-pressed={isActive}
              className={`w-full flex gap-3 p-3.5 rounded-[14px] text-left transition-transform duration-[120ms] ease-out ${
                isActive
                  ? 'bg-[var(--primary-tint)] border-[1.5px] border-[var(--primary)]'
                  : 'bg-[var(--surface)] border-[0.5px] border-[var(--hairline)]'
              }`}
            >
              <span
                className={`w-[22px] h-[22px] rounded-full shrink-0 inline-flex items-center justify-center text-white mt-0.5 ${
                  isActive
                    ? 'border-2 border-[var(--primary)] bg-[var(--primary)]'
                    : 'border-2 border-[var(--surface-3)] bg-transparent'
                }`}
              >
                {isActive && <Icon name="check" size={12} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2.5">
                  <span className="font-heading font-semibold text-[15px] text-[var(--ink)]">{tier.name}</span>
                  <span className="text-[11px] font-extrabold text-[var(--muted)] tracking-[0.4px] uppercase">
                    {tier.dupr}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--ink-2)] mt-1">{tier.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[12px] font-bold text-[var(--coral)]">{error}</p>}
    </div>
  );
}
