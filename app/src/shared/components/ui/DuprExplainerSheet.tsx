import { BottomSheet } from './BottomSheet';
import { skillTiers } from '../../lib/skillTiers';

interface DuprExplainerSheetProps {
  open: boolean;
  onClose: () => void;
}

export function DuprExplainerSheet({ open, onClose }: DuprExplainerSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="What's DUPR?" subtitle="A quick guide to skill levels.">
      <div className="px-5 pb-2 text-[14px] leading-[1.5] text-[var(--ink-2)]">
        <p>
          <strong className="text-[var(--ink)]">DUPR</strong> (Dynamic Universal Pickleball Rating) is a 1.0–8.0 score from
          competitive pickleball. We map it to four plain-English tiers so you don't need to know your number.
        </p>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-3">
        {skillTiers.map((tier) => (
          <div
            key={tier.id}
            className="rounded-[14px] p-3.5 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading font-semibold text-[16px] text-[var(--ink)]">{tier.name}</h3>
              <span className="bg-[var(--lime)] text-[var(--lime-ink)] px-2.5 py-0.5 rounded-full font-heading font-semibold text-[11px] tracking-[0.4px]">
                {tier.dupr}
              </span>
            </div>
            <p className="text-[13px] text-[var(--ink-2)] mt-1.5 font-bold">{tier.blurb}</p>
            <p className="text-[13px] text-[var(--muted)] mt-1.5 leading-[1.5]">{tier.detail}</p>
          </div>
        ))}
      </div>

      <div className="px-5 pt-3.5 pb-6 text-[13px] text-[var(--muted)]">
        Not sure? Pick the tier that sounds like you — your rating will adjust naturally as you play.
      </div>
    </BottomSheet>
  );
}
