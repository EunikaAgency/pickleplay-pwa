import { Icon } from './Icon';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon = 'paddle', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <div className="w-16 h-16 rounded-[20px] bg-[var(--surface-2)] text-[var(--muted)] flex items-center justify-center mb-3.5">
        <Icon name={icon} size={28} />
      </div>
      <div className="hd-2 mb-1.5">{title}</div>
      <div className="t-sm max-w-[320px]">{description}</div>
      {action && (
        <Button className="mt-[18px]" onClick={action.onPress}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
