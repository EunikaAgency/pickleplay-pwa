import { Icon } from './Icon';
import { BottomSheet } from './BottomSheet';
import { skillTiers } from '../../lib/skillTiers';

interface DuprExplainerSheetProps {
  open: boolean;
  onClose: () => void;
}

export function DuprExplainerSheet({ open, onClose }: DuprExplainerSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="What's DUPR?"
      subtitle="A quick guide to skill levels in PickleBallers."
    >
      <p className="text-body-md text-on-surface-variant">
        <strong className="font-bold text-on-surface">DUPR</strong> (Dynamic Universal Pickleball Rating) is a 1.0–8.0 score that came out of competitive pickleball.
        PickleBallers maps it to four plain-English tiers so you don't need to know your exact number to find a great game.
      </p>

      <div className="mt-5 space-y-3">
        {skillTiers.map((tier) => (
          <div
            key={tier.id}
            className="rounded-[14px] border border-outline-variant/40 bg-surface-container-low p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-body-lg font-bold text-on-surface">{tier.name}</h3>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-label-sm font-bold tracking-wider uppercase text-primary">
                {tier.dupr}
              </span>
            </div>
            <p className="mt-1 text-body-md font-bold text-on-surface-variant">{tier.blurb}</p>
            <p className="mt-2 text-body-md text-on-surface-variant">{tier.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[14px] bg-secondary-container/30 p-4 text-body-md text-on-surface">
        <p className="font-bold">Don't know your DUPR?</p>
        <p className="mt-1 text-on-surface-variant">
          Pick the tier that sounds like you. You can change it any time in your profile, and your rating will adjust naturally as you play more games.
        </p>
      </div>

      <a
        href="https://dupr.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-1.5 text-body-md font-bold text-primary hover:underline"
      >
        Learn more at dupr.com
        <Icon name="open_in_new" size={16} />
      </a>
    </BottomSheet>
  );
}
