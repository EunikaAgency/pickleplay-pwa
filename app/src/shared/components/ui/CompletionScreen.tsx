import { Icon } from './Icon';
import { Button } from './Button';

type CompletionVariant = 'primary' | 'outline' | 'dark';

interface CompletionAction {
  label: string;
  onClick: () => void;
  variant?: CompletionVariant;
}

interface CompletionScreenProps {
  icon: string;
  iconSize?: number;
  title: string;
  description: string;
  actions: CompletionAction[];
}

export function CompletionScreen({
  icon,
  iconSize = 42,
  title,
  description,
  actions,
}: CompletionScreenProps) {
  const single = actions.length === 1;
  return (
    <div className="scroll safe-top safe-bottom flex flex-col items-center justify-center text-center px-6">
      <div className="w-[88px] h-[88px] rounded-full bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center mb-[18px] shadow-[var(--shadow-fab)]">
        <Icon name={icon} size={iconSize} />
      </div>
      <h2 className="hd-1 mb-1.5">{title}</h2>
      <p className="t-sm max-w-[320px]">{description}</p>
      {single ? (
        <Button
          variant={actions[0].variant ?? 'primary'}
          fullWidth
          className="mt-[22px] max-w-[360px]"
          onClick={actions[0].onClick}
        >
          {actions[0].label}
        </Button>
      ) : (
        <div className="flex gap-2.5 mt-[22px] w-full max-w-[360px]">
          {actions.map((a, i) => (
            <Button
              key={i}
              variant={a.variant ?? 'primary'}
              fullWidth
              className="flex-1"
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
