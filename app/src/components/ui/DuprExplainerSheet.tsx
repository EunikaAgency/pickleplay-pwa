import { BottomSheet } from './BottomSheet';
import { skillTiers } from '../../lib/skillTiers';

interface DuprExplainerSheetProps {
  open: boolean;
  onClose: () => void;
}

export function DuprExplainerSheet({ open, onClose }: DuprExplainerSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="What's DUPR?" subtitle="A quick guide to skill levels.">
      <div style={{ padding: '0 20px 8px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.5 }}>
        <p>
          <strong style={{ color: 'var(--ink)' }}>DUPR</strong> (Dynamic Universal Pickleball Rating) is a 1.0–8.0 score from
          competitive pickleball. We map it to four plain-English tiers so you don't need to know your number.
        </p>
      </div>

      <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {skillTiers.map((tier) => (
          <div
            key={tier.id}
            style={{
              background: 'var(--surface)',
              border: '0.5px solid var(--hairline)',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
                {tier.name}
              </h3>
              <span
                style={{
                  background: 'var(--lime)',
                  color: 'var(--lime-ink)',
                  padding: '2px 10px',
                  borderRadius: 999,
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: 0.4,
                }}
              >
                {tier.dupr}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, fontWeight: 700 }}>{tier.blurb}</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{tier.detail}</p>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 20px 24px', color: 'var(--muted)', fontSize: 13 }}>
        Not sure? Pick the tier that sounds like you — your rating will adjust naturally as you play.
      </div>
    </BottomSheet>
  );
}
