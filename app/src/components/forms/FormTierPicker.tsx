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
    <div className="field" style={{ padding: 0 }}>
      {label && <div className="lbl">{label}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {skillTiers.map((tier) => {
          const isActive = value === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => onChange(tier.id)}
              aria-pressed={isActive}
              style={{
                width: '100%',
                display: 'flex',
                gap: 12,
                padding: 14,
                borderRadius: 14,
                background: isActive ? 'var(--primary-tint)' : 'var(--surface)',
                border: isActive ? '1.5px solid var(--primary)' : '0.5px solid var(--hairline)',
                textAlign: 'left',
                transition: 'transform .12s ease',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isActive ? '2px solid var(--primary)' : '2px solid var(--surface-3)',
                  background: isActive ? 'var(--primary)' : 'transparent',
                  color: 'white',
                  marginTop: 2,
                }}
              >
                {isActive && <Icon name="check" size={12} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                    {tier.name}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                    {tier.dupr}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{tier.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>
      {error && (
        <p style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--coral)' }}>{error}</p>
      )}
    </div>
  );
}
