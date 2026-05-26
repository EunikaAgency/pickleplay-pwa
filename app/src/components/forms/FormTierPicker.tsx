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
    <div className="space-y-2">
      {label && (
        <span className="block text-label-sm font-bold uppercase tracking-wider text-on-surface-variant ml-1">
          {label}
        </span>
      )}
      <div className="space-y-2.5">
        {skillTiers.map((tier) => {
          const isActive = value === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => onChange(tier.id)}
              aria-pressed={isActive}
              className={`w-full flex items-start gap-3 rounded-[14px] p-4 text-left transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                isActive
                  ? 'border-2 border-primary bg-primary/5 shadow-card'
                  : 'border border-outline-variant bg-surface-container-lowest hover:border-primary/40'
              }`}
            >
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  isActive ? 'border-primary bg-primary' : 'border-outline-variant'
                }`}
              >
                {isActive && <Icon name="check" size={14} className="text-on-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-heading text-body-lg font-bold text-on-surface">{tier.name}</span>
                  <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                    {tier.dupr}
                  </span>
                </div>
                <p className="text-body-md text-on-surface-variant">{tier.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>
      {error && <p className="text-label-sm font-bold text-error ml-1">{error}</p>}
    </div>
  );
}
