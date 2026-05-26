import { Icon } from './Icon';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-5">
        <Icon name={icon} size={40} className="text-outline-variant" />
      </div>
      <h3 className="font-heading text-headline-md text-on-surface mb-2">{title}</h3>
      <p className="text-body-md text-on-surface-variant max-w-xs mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onPress}
          className="h-12 px-8 bg-secondary-container text-on-secondary-container font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all"
          style={{ boxShadow: 'var(--shadow-button)' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
