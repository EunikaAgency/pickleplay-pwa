import { Icon } from '../ui/Icon';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container transition-all hover:scale-110 active:scale-90"
      style={{ boxShadow: '0 8px 30px -4px rgba(0, 64, 224, 0.15)' }}
    >
      <Icon name="add" size={28} weight={600} />
    </button>
  );
}
