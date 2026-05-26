import { Icon } from '../ui/Icon';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container transition-all hover:scale-110 active:scale-90 md:hidden"
      style={{
        bottom: 'calc(4.25rem + env(safe-area-inset-bottom))',
        boxShadow: 'var(--shadow-fab)',
      }}
    >
      <Icon name="add" size={28} weight={600} />
    </button>
  );
}
