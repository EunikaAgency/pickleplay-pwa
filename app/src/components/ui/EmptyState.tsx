import { Icon } from './Icon';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon = 'paddle', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'var(--surface-2)',
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Icon name={icon} size={28} />
      </div>
      <div className="hd-2" style={{ marginBottom: 6 }}>{title}</div>
      <div className="t-sm" style={{ maxWidth: 320 }}>{description}</div>
      {action && (
        <button className="btn-primary" style={{ marginTop: 18, width: 'auto', padding: '0 24px' }} onClick={action.onPress}>
          {action.label}
        </button>
      )}
    </div>
  );
}
